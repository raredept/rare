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
};

function getSessionSecret() {
  return new TextEncoder().encode(getAdminSessionSecret());
}

export async function signAdminSession(user: Pick<User, "id" | "email" | "role">) {
  return new SignJWT({ email: user.email, role: user.role } satisfies Omit<AdminSessionPayload, "sub">)
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
    if (payload.role !== "ADMIN" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: "ADMIN",
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

  return prisma.user.findFirst({
    where: {
      id: session.sub,
      role: "ADMIN",
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
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
