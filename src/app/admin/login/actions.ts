"use server";

import { redirect } from "next/navigation";
import { checkLoginRateLimit, verifyPasswordConstantCost } from "@/lib/login-guard";
import { prisma } from "@/lib/prisma";
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
    return { error: "Informe login e senha validos." };
  }

  const identifier = parsed.data.email.toLowerCase();
  if (!(await checkLoginRateLimit("admin-login", identifier))) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const user = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
      active: true,
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { username: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  const validPassword = await verifyPasswordConstantCost(parsed.data.password, user?.passwordHash);
  if (!user || !validPassword) {
    return { error: "Credenciais invalidas." };
  }

  const token = await signAdminSession(user);
  await setAdminSessionCookie(token);

  if (user.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const next = formData.get("next");
  const target = typeof next === "string" && next.startsWith("/admin") && next !== "/admin/login" ? next : "/admin";
  redirect(target);
}
