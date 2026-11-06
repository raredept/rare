"use server";

import { checkMfaRateLimit, regenerateRecoveryCodes } from "@/lib/admin-mfa";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type RegenerateCodesState = { error?: string; recoveryCodes?: string[] };

export async function regenerateRecoveryCodesAction(_state: RegenerateCodesState, formData: FormData): Promise<RegenerateCodesState> {
  const admin = await requireAdmin();
  if (!(await checkMfaRateLimit(admin.id))) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: admin.id },
    select: {
      id: true,
      email: true,
      mfaEnabledAt: true,
      mfaSecretEncrypted: true,
      mfaLastUsedStep: true,
      mfaPendingSecretEncrypted: true,
      mfaPendingCreatedAt: true,
    },
  });
  if (!user.mfaEnabledAt) return { error: "A verificação em duas etapas não está ativa nesta conta." };
  const result = await regenerateRecoveryCodes(user, formData.get("code"), admin.username ?? admin.email);
  if (!result.ok) {
    return { error: result.reason === "replay" ? "Este código já foi usado. Aguarde o próximo código." : "Código do autenticador inválido." };
  }
  return { recoveryCodes: result.recoveryCodes };
}
