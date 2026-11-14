"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { ASSIGNABLE_ADMIN_ROLES } from "@/lib/admin-permissions";
import {
  AdminUserError,
  assignAdminRole,
  createAdminUser,
  resetAdminUserMfa,
  revokeAdminUserSessions,
  setAdminUserActive,
} from "@/lib/admin-users";
import { requireAdmin } from "@/lib/auth";

const userIdSchema = z.string().trim().min(1).max(64);
const roleSchema = z.enum(ASSIGNABLE_ADMIN_ROLES);
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  username: z.string().trim().max(60).regex(/^[a-z0-9._-]*$/i).optional(),
  role: roleSchema,
});

export type CreateAdminUserState = { error?: string; temporaryPassword?: string; email?: string };

function actorOf(admin: { id: string; username: string | null; email: string }) {
  return { id: admin.id, label: admin.username ?? admin.email };
}

function done(query: string): never {
  revalidatePath("/admin/users");
  redirect(withAdminActionRefresh(`/admin/users?${query}`));
}

function fail(error: unknown): never {
  if (error instanceof AdminUserError) done(`error=admin-user-${error.code}`);
  throw error;
}

export async function createAdminUserAction(_state: CreateAdminUserState, formData: FormData): Promise<CreateAdminUserState> {
  const admin = await requireAdmin("system.users");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Revise nome, e-mail, login e papel." };
  try {
    const result = await createAdminUser(actorOf(admin), parsed.data);
    revalidatePath("/admin/users");
    return { temporaryPassword: result.temporaryPassword, email: parsed.data.email.toLowerCase() };
  } catch (error) {
    if (error instanceof AdminUserError && error.code === "email-taken") return { error: "Já existe uma conta com este e-mail ou login." };
    throw error;
  }
}

export async function setAdminUserActiveAction(formData: FormData) {
  const admin = await requireAdmin("system.users");
  const userId = userIdSchema.safeParse(formData.get("userId"));
  const active = formData.get("active");
  if (!userId.success || (active !== "true" && active !== "false")) done("error=admin-user-invalid");
  try {
    await setAdminUserActive(actorOf(admin), userId.data, active === "true");
  } catch (error) {
    fail(error);
  }
  done(`success=${active === "true" ? "admin-user-activated" : "admin-user-deactivated"}`);
}

export async function assignAdminRoleAction(formData: FormData) {
  const admin = await requireAdmin("system.users");
  const userId = userIdSchema.safeParse(formData.get("userId"));
  // The role is checked against the server allowlist; the legacy ADMIN role can never be granted.
  const role = roleSchema.safeParse(formData.get("role"));
  if (!userId.success || !role.success) done("error=admin-user-invalid");
  let changedSelf = false;
  try {
    const result = await assignAdminRole(actorOf(admin), userId.data, role.data);
    changedSelf = result.changed && userId.data === admin.id;
  } catch (error) {
    fail(error);
  }
  // Changing a role revokes that account's sessions, including the current one when it is yours.
  if (changedSelf) redirect("/admin/login");
  done("success=admin-user-role-saved");
}

export async function revokeAdminUserSessionsAction(formData: FormData) {
  const admin = await requireAdmin("system.users");
  const userId = userIdSchema.safeParse(formData.get("userId"));
  if (!userId.success) done("error=admin-user-invalid");
  try {
    await revokeAdminUserSessions(actorOf(admin), userId.data);
  } catch (error) {
    fail(error);
  }
  done("success=admin-user-sessions-revoked");
}

export async function resetAdminUserMfaAction(formData: FormData) {
  const admin = await requireAdmin("system.users");
  const userId = userIdSchema.safeParse(formData.get("userId"));
  const reason = formData.get("reason");
  if (!userId.success) done("error=admin-user-invalid");
  try {
    await resetAdminUserMfa(actorOf(admin), userId.data, typeof reason === "string" ? reason : "");
  } catch (error) {
    fail(error);
  }
  done("success=admin-user-mfa-reset");
}
