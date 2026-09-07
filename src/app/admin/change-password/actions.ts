"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getCurrentAdmin, setAdminSessionCookie, signAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ChangePasswordState = {
  error?: string;
};

function validateNewPassword(password: string) {
  if (password.length < 12) {
    return "A nova senha deve ter pelo menos 12 caracteres.";
  }

  if (bcrypt.truncates(password)) {
    return "A nova senha e longa demais. Use ate 72 caracteres simples ou reduza os caracteres especiais.";
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use ao menos uma letra maiuscula, uma minuscula e um numero.";
  }

  return null;
}

export async function changePasswordAction(
  _state: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.mustChangePassword) redirect("/admin");

  const password = formData.get("password");
  const confirmation = formData.get("passwordConfirmation");
  if (typeof password !== "string" || typeof confirmation !== "string") {
    return { error: "Informe e confirme a nova senha." };
  }

  const validationError = validateNewPassword(password);
  if (validationError) return { error: validationError };
  if (password !== confirmation) return { error: "As senhas nao conferem." };

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.user.updateMany({
    where: {
      id: admin.id,
      role: "ADMIN",
      active: true,
      mustChangePassword: true,
    },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  if (result.count !== 1) {
    return { error: "Nao foi possivel atualizar a senha. Entre novamente e tente outra vez." };
  }

  const token = await signAdminSession({ ...admin, mustChangePassword: false, passwordHash });
  await setAdminSessionCookie(token);
  redirect("/admin?success=password-updated");
}
