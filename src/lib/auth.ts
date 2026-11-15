import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@prisma/client";
import { getAdminSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ADMIN_MFA_PENDING_COOKIE, ADMIN_SESSION_COOKIE } from "@/lib/auth-constants";
import { isAdminMfaRequired } from "@/lib/admin-mfa-config";
import {
  ADMIN_ROLES,
  getAdminPermissions,
  hasAdminPermission,
  isAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-permissions";

type AdminSessionPayload = {
  sub: string;
  email: string;
  /** As issued; authorization always uses the role read from the database. */
  role: AdminRole;
  mustChangePassword: boolean;
  credentialVersion: string;
  /** Tokens issued before this feature carry none and count as 0. */
  sessionVersion: number;
  /** A second factor was verified when this session was issued. Older tokens carry none. */
  mfa: boolean;
  /** Epoch seconds of that verification. */
  mfaAt: number | null;
};

type SessionUser = Pick<User, "id" | "email" | "role" | "mustChangePassword" | "passwordHash" | "sessionVersion">;

const ADMIN_SESSION_TYPE = "admin";
const MFA_PENDING_TYPE = "admin_mfa_pending";
export const ADMIN_MFA_PENDING_TTL_SECONDS = 10 * 60;

function getSessionSecret() {
  return new TextEncoder().encode(getAdminSessionSecret());
}

async function buildCredentialVersion(passwordHash: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwordHash));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signAdminSession(user: SessionUser, options: { mfaVerifiedAt?: Date | null } = {}) {
  const mfaAt = options.mfaVerifiedAt ? Math.floor(options.mfaVerifiedAt.getTime() / 1000) : null;
  return new SignJWT({
    typ: ADMIN_SESSION_TYPE,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    credentialVersion: await buildCredentialVersion(user.passwordHash),
    sessionVersion: user.sessionVersion,
    mfa: mfaAt !== null,
    mfaAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSessionSecret());
}

export async function verifyAdminSession(token?: string | null): Promise<AdminSessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] });
    if (
      (payload.typ !== undefined && payload.typ !== ADMIN_SESSION_TYPE) ||
      !isAdminRole(payload.role) ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.credentialVersion !== "string" ||
      (payload.sessionVersion !== undefined && !Number.isSafeInteger(payload.sessionVersion))
    ) {
      return null;
    }

    const mfa = payload.mfa === true && typeof payload.mfaAt === "number" && Number.isSafeInteger(payload.mfaAt);
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as AdminRole,
      mustChangePassword: payload.mustChangePassword === true,
      credentialVersion: payload.credentialVersion,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
      mfa,
      mfaAt: mfa ? (payload.mfaAt as number) : null,
    };
  } catch {
    return null;
  }
}

/**
 * The Admin identity behind the current request, or null. This is the single authorization
 * gate: pages, server actions and /api/admin routes all go through it. A session without a
 * verified second factor is refused whenever MFA is required or the account has enrolled, so a
 * correct password alone (or a token issued before MFA existed) never reaches Admin data.
 */
export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  if (!session) return null;

  const admin = await prisma.user.findFirst({
    where: {
      id: session.sub,
      role: { in: [...ADMIN_ROLES] },
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      mustChangePassword: true,
      passwordHash: true,
      sessionVersion: true,
      mfaEnabledAt: true,
    },
  });

  if (
    !admin ||
    session.sessionVersion !== admin.sessionVersion ||
    session.credentialVersion !== await buildCredentialVersion(admin.passwordHash)
  ) {
    return null;
  }

  if ((isAdminMfaRequired() || admin.mfaEnabledAt) && !session.mfa) {
    return null;
  }

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    username: admin.username,
    role: admin.role as AdminRole,
    permissions: getAdminPermissions(admin.role),
    mustChangePassword: admin.mustChangePassword,
    sessionVersion: admin.sessionVersion,
    mfaEnabled: Boolean(admin.mfaEnabledAt),
    mfaVerifiedAt: session.mfaAt === null ? null : new Date(session.mfaAt * 1000),
  };
}

export type CurrentAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentAdmin>>>;

export const ADMIN_ACCESS_DENIED_PATH = "/admin/sem-acesso";

/**
 * Pages, Server Actions and Route Handlers pass the permission they need; the layout alone passes
 * none (it only needs a valid session). A missing permission ends the request before any data
 * is read or written.
 */
export async function requireAdmin(permission?: AdminPermission) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) redirect("/admin/change-password");
  if (permission && !hasAdminPermission(admin.role, permission)) {
    console.warn("[rbac] denied", JSON.stringify({ role: admin.role, permission }));
    redirect(ADMIN_ACCESS_DENIED_PATH);
  }
  return admin;
}

export async function setAdminSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/**
 * Proof that the password was right, valid only for the MFA step and for a few minutes. It has
 * no role claim and a distinct type, so neither verifyAdminSession nor the proxy accept it as
 * an Admin session. It is bound to the credential and session versions like a real session.
 */
export async function signAdminMfaPendingToken(user: SessionUser, next: string) {
  return new SignJWT({
    typ: MFA_PENDING_TYPE,
    credentialVersion: await buildCredentialVersion(user.passwordHash),
    sessionVersion: user.sessionVersion,
    next,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_MFA_PENDING_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function setAdminMfaPendingCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_MFA_PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_MFA_PENDING_TTL_SECONDS,
  });
}

export async function clearAdminMfaPendingCookie() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: ADMIN_MFA_PENDING_COOKIE, path: "/admin" });
}

/** The account that passed the password step in the last few minutes, or null. */
export async function getPendingMfaAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_MFA_PENDING_COOKIE)?.value;
  if (!token) return null;

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  if (
    payload.typ !== MFA_PENDING_TYPE ||
    typeof payload.sub !== "string" ||
    typeof payload.credentialVersion !== "string" ||
    !Number.isSafeInteger(payload.sessionVersion)
  ) {
    return null;
  }

  const admin = await prisma.user.findFirst({
    where: { id: payload.sub, role: { in: [...ADMIN_ROLES] }, active: true },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      mustChangePassword: true,
      passwordHash: true,
      sessionVersion: true,
      mfaEnabledAt: true,
      mfaSecretEncrypted: true,
      mfaLastUsedStep: true,
      mfaPendingSecretEncrypted: true,
      mfaPendingCreatedAt: true,
    },
  });
  if (
    !admin ||
    admin.sessionVersion !== payload.sessionVersion ||
    payload.credentialVersion !== await buildCredentialVersion(admin.passwordHash)
  ) {
    return null;
  }

  return { ...admin, next: typeof payload.next === "string" ? payload.next : "/admin" };
}

export type PendingMfaAdmin = NonNullable<Awaited<ReturnType<typeof getPendingMfaAdmin>>>;

/**
 * Logout. Deleting the cookie alone left the token valid until it expired, so
 * a copy of it (another device, a proxy log, a stolen cookie) kept working
 * after "Sair". Bumping sessionVersion makes every token issued for this
 * account so far invalid. Only a token with a valid signature can trigger it,
 * and the cookie is cleared even if the database write fails.
 */
export async function endAdminSession() {
  const cookieStore = await cookies();
  const session = await verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  try {
    if (session) {
      await prisma.user.updateMany({
        where: { id: session.sub, sessionVersion: session.sessionVersion },
        data: { sessionVersion: { increment: 1 } },
      });
    }
  } catch (error) {
    console.error("[auth] could not revoke admin sessions on logout", error instanceof Error ? error.name : "unknown");
  } finally {
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    cookieStore.delete({ name: ADMIN_MFA_PENDING_COOKIE, path: "/admin" });
  }
}
