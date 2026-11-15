import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { recordAdminAudit, type AdminAuditActor } from "@/lib/admin-audit";
import { resetAdminMfa } from "@/lib/admin-mfa";
import {
  ADMIN_ROLES,
  USER_MANAGER_ROLES,
  hasAdminPermission,
  type AssignableAdminRole,
} from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

// Admin account management for /admin/users. Every change that can remove user-management
// access (deactivation, demotion) first locks the active managers, in id order, and only then the
// target row. Two concurrent demotions therefore queue on the same first lock instead of
// deadlocking, and the second one re-reads the manager set after the first commits, so the store
// can never be left with no active user manager.

export type AdminUserErrorCode = "not-found" | "self-change" | "last-system-admin" | "email-taken" | "mfa-reason";

export class AdminUserError extends Error {
  constructor(readonly code: AdminUserErrorCode) {
    super(code);
    this.name = "AdminUserError";
  }
}

type Tx = Prisma.TransactionClient;

const adminRoleFilter = { in: [...ADMIN_ROLES] };

async function lockActiveUserManagers(tx: Tx) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User"
    WHERE "active" = true AND "role"::text IN (${Prisma.join([...USER_MANAGER_ROLES])})
    ORDER BY "id"
    FOR UPDATE`;
  return rows.map((row) => row.id);
}

async function lockTarget(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findFirst({
    where: { id: userId, role: adminRoleFilter },
    select: { id: true, role: true, active: true },
  });
  if (!user) throw new AdminUserError("not-found");
  return user;
}

function assertAnotherManagerRemains(managers: string[], targetId: string) {
  if (!managers.some((id) => id !== targetId)) throw new AdminUserError("last-system-admin");
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const [host = "", ...rest] = domain.split(".");
  const mask = (value: string) => (value.length <= 1 ? "*" : `${value[0]}${"*".repeat(Math.min(value.length - 1, 6))}`);
  return `${mask(local)}@${mask(host)}${rest.length ? `.${rest.join(".")}` : ""}`;
}

export async function listAdminUsers() {
  return prisma.user.findMany({
    where: { role: adminRoleFilter },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      active: true,
      mustChangePassword: true,
      mfaEnabledAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createAdminUser(
  actor: AdminAuditActor,
  input: { name: string; email: string; username?: string | null; role: AssignableAdminRole },
) {
  const email = input.email.trim().toLowerCase();
  const username = input.username?.trim().toLowerCase() || null;
  const taken = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        ...(username ? [{ username: { equals: username, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true },
  });
  if (taken) throw new AdminUserError("email-taken");

  // Shown once to the operator; the account must replace it at first login, then enrol MFA.
  const temporaryPassword = randomBytes(15).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: input.name.trim(), email, username, passwordHash, role: input.role, active: true, mustChangePassword: true },
        select: { id: true, role: true },
      });
      await recordAdminAudit(tx, {
        actor,
        action: "admin_user.created",
        entityType: "User",
        entityId: created.id,
        after: { role: created.role, active: true, mustChangePassword: true },
      });
      return created;
    });
    return { user, temporaryPassword };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AdminUserError("email-taken");
    throw error;
  }
}

export async function setAdminUserActive(actor: AdminAuditActor, userId: string, active: boolean) {
  if (actor.id === userId) throw new AdminUserError("self-change");
  await prisma.$transaction(async (tx) => {
    const managers = active ? null : await lockActiveUserManagers(tx);
    const before = await lockTarget(tx, userId);
    if (before.active === active) return;
    if (managers && hasAdminPermission(before.role, "system.users")) assertAnotherManagerRemains(managers, userId);
    await tx.user.update({ where: { id: userId }, data: { active, sessionVersion: { increment: 1 } } });
    await recordAdminAudit(tx, {
      actor,
      action: active ? "admin_user.activated" : "admin_user.deactivated",
      entityType: "User",
      entityId: userId,
      before: { active: before.active },
      after: { active, sessionsRevoked: true },
    });
  });
}

export async function assignAdminRole(actor: AdminAuditActor, userId: string, role: AssignableAdminRole) {
  // An operator may move their own legacy account to SYSTEM_ADMIN, never out of user management.
  if (actor.id === userId && !hasAdminPermission(role, "system.users")) throw new AdminUserError("self-change");
  return prisma.$transaction(async (tx) => {
    const managers = hasAdminPermission(role, "system.users") ? null : await lockActiveUserManagers(tx);
    const before = await lockTarget(tx, userId);
    if (before.role === role) return { changed: false };
    if (managers && before.active && hasAdminPermission(before.role, "system.users")) {
      assertAnotherManagerRemains(managers, userId);
    }
    await tx.user.update({ where: { id: userId }, data: { role, sessionVersion: { increment: 1 } } });
    await recordAdminAudit(tx, {
      actor,
      action: "admin_user.role_changed",
      entityType: "User",
      entityId: userId,
      before: { role: before.role },
      after: { role, sessionsRevoked: true },
    });
    return { changed: true };
  });
}

export async function revokeAdminUserSessions(actor: AdminAuditActor, userId: string) {
  if (actor.id === userId) throw new AdminUserError("self-change");
  await prisma.$transaction(async (tx) => {
    await lockTarget(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    await recordAdminAudit(tx, { actor, action: "admin_user.sessions_revoked", entityType: "User", entityId: userId, after: { sessionsRevoked: true } });
  });
}

export async function resetAdminUserMfa(actor: AdminAuditActor, userId: string, reason: string) {
  if (actor.id === userId) throw new AdminUserError("self-change");
  if (reason.trim().length < 8) throw new AdminUserError("mfa-reason");
  const target = await prisma.user.findFirst({ where: { id: userId, role: adminRoleFilter }, select: { id: true } });
  if (!target) throw new AdminUserError("not-found");
  return resetAdminMfa(userId, actor.label, reason.trim(), actor.id);
}
