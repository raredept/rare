import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@prisma/client";
import { getAdminSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth-constants";

type AdminSessionPayload = {
  sub: string;
  email: string;
  role: "ADMIN";
  mustChangePassword: boolean;
  credentialVersion: string;
  /** Tokens issued before this feature carry none and count as 0. */
  sessionVersion: number;
};

function getSessionSecret() {
  return new TextEncoder().encode(getAdminSessionSecret());
}

async function buildCredentialVersion(passwordHash: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwordHash));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signAdminSession(
  user: Pick<User, "id" | "email" | "role" | "mustChangePassword" | "passwordHash" | "sessionVersion">,
) {
  return new SignJWT({
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    credentialVersion: await buildCredentialVersion(user.passwordHash),
    sessionVersion: user.sessionVersion,
  } satisfies Omit<AdminSessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSessionSecret());
}

export async function verifyAdminSession(token?: string | null): Promise<AdminSessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (
      payload.role !== "ADMIN" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.credentialVersion !== "string" ||
      (payload.sessionVersion !== undefined && !Number.isSafeInteger(payload.sessionVersion))
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: "ADMIN",
      mustChangePassword: payload.mustChangePassword === true,
      credentialVersion: payload.credentialVersion,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
    };
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  if (!session) return null;

  const admin = await prisma.user.findFirst({
    where: {
      id: session.sub,
      role: "ADMIN",
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
    },
  });

  if (
    !admin ||
    session.sessionVersion !== admin.sessionVersion ||
    session.credentialVersion !== await buildCredentialVersion(admin.passwordHash)
  ) {
    return null;
  }

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    username: admin.username,
    role: admin.role,
    mustChangePassword: admin.mustChangePassword,
    sessionVersion: admin.sessionVersion,
  };
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mustChangePassword) redirect("/admin/change-password");
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
  }
}
