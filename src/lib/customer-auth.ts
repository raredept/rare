import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Customer } from "@prisma/client";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth-constants";
import { getAdminSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type CustomerSessionPayload = {
  sub: string;
  email: string;
  role: "CUSTOMER";
};

export type CurrentCustomer = Pick<Customer, "id" | "name" | "email" | "phone" | "cpf" | "active">;

function getSessionSecret() {
  return new TextEncoder().encode(getAdminSessionSecret());
}

export async function signCustomerSession(customer: Pick<Customer, "id" | "email">) {
  return new SignJWT({ email: customer.email, role: "CUSTOMER" } satisfies Omit<CustomerSessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customer.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSessionSecret());
}

export async function verifyCustomerSession(token?: string | null): Promise<CustomerSessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (payload.role !== "CUSTOMER" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: "CUSTOMER",
    };
  } catch {
    return null;
  }
}

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const session = await verifyCustomerSession(token);
  if (!session) return null;

  return prisma.customer.findFirst({
    where: {
      id: session.sub,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      active: true,
    },
  });
}

export async function requireCustomer(next = "/minha-conta") {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect(`/entrar?next=${encodeURIComponent(next)}`);
  }
  return customer;
}

export async function setCustomerSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCustomerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
}
