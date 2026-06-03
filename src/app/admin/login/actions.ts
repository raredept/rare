"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";
import { setAdminSessionCookie, signAdminSession } from "@/lib/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Informe e-mail e senha validos." };
  }

  const limit = await rateLimit(`admin-login:${parsed.data.email}`, 8, 5 * 60_000);
  if (!limit.ok) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const user = await prisma.user.findFirst({
    where: {
      email: parsed.data.email.toLowerCase(),
      role: "ADMIN",
      active: true,
    },
  });

  if (!user) {
    return { error: "Credenciais invalidas." };
  }

  const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    return { error: "Credenciais invalidas." };
  }

  const token = await signAdminSession(user);
  await setAdminSessionCookie(token);

  const next = formData.get("next");
  const target = typeof next === "string" && next.startsWith("/admin") && next !== "/admin/login" ? next : "/admin";
  redirect(target);
}
