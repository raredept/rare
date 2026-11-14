"use server";

import { redirect } from "next/navigation";
import { checkLoginRateLimit, verifyPasswordConstantCost } from "@/lib/login-guard";
import { prisma } from "@/lib/prisma";
import { getSafeAdminNext } from "@/lib/safe-redirect";
import { loginSchema } from "@/lib/validators";
import { setAdminMfaPendingCookie, setAdminSessionCookie, signAdminMfaPendingToken, signAdminSession } from "@/lib/auth";
import { getAdminMfaConfigurationIssue, isAdminMfaRequired } from "@/lib/admin-mfa-config";
import { ADMIN_ROLES } from "@/lib/admin-permissions";

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
      role: { in: [...ADMIN_ROLES] },
      active: true,
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { username: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  const validPassword = await verifyPasswordConstantCost(parsed.data.password, user?.passwordHash);
  if (!user || !validPassword) {
    return { error: "Credenciais inválidas." };
  }

  const next = getSafeAdminNext(formData.get("next"));

  // The password alone never yields an Admin session when a second factor applies: only a
  // short-lived "pending" credential that the MFA step (or the mandatory enrollment) accepts.
  if (isAdminMfaRequired() || user.mfaEnabledAt) {
    if (getAdminMfaConfigurationIssue()) {
      console.error("[auth] admin MFA is required but its server key is not configured");
      return { error: "Verificação em duas etapas indisponível no servidor. Avise o responsável técnico." };
    }
    await setAdminMfaPendingCookie(await signAdminMfaPendingToken(user, next));
    redirect(user.mfaEnabledAt ? "/admin/mfa" : "/admin/mfa/setup");
  }

  const token = await signAdminSession(user);
  await setAdminSessionCookie(token);

  if (user.mustChangePassword) {
    redirect("/admin/change-password");
  }

  redirect(next);
}
