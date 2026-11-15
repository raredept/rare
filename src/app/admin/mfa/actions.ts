"use server";

import { redirect } from "next/navigation";
import {
  clearAdminMfaPendingCookie,
  getPendingMfaAdmin,
  setAdminSessionCookie,
  signAdminSession,
  type PendingMfaAdmin,
} from "@/lib/auth";
import { checkMfaRateLimit, confirmEnrollment, verifyMfaChallenge } from "@/lib/admin-mfa";
import { getSafeAdminNext } from "@/lib/safe-redirect";

export type MfaChallengeState = { error?: string };
export type MfaEnrollmentState = { error?: string; recoveryCodes?: string[]; continueTo?: string };

const rateLimitedMessage = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

function actorLabel(admin: PendingMfaAdmin) {
  return admin.username ?? admin.email;
}

async function issueFullSession(admin: PendingMfaAdmin, verifiedAt: Date) {
  await setAdminSessionCookie(await signAdminSession(admin, { mfaVerifiedAt: verifiedAt }));
  await clearAdminMfaPendingCookie();
  return admin.mustChangePassword ? "/admin/change-password" : getSafeAdminNext(admin.next);
}

export async function verifyMfaAction(_state: MfaChallengeState, formData: FormData): Promise<MfaChallengeState> {
  const admin = await getPendingMfaAdmin();
  if (!admin) redirect("/admin/login");
  if (!admin.mfaEnabledAt) redirect("/admin/mfa/setup");
  if (!(await checkMfaRateLimit(admin.id))) return { error: rateLimitedMessage };

  const result = await verifyMfaChallenge(admin, formData.get("code"), actorLabel(admin));
  if (!result.ok) {
    return { error: result.reason === "replay" ? "Este código já foi usado. Aguarde o próximo código do aplicativo." : "Código inválido. Confira o aplicativo autenticador ou use um código de recuperação." };
  }
  redirect(await issueFullSession(admin, result.verifiedAt));
}

export async function confirmEnrollmentAction(_state: MfaEnrollmentState, formData: FormData): Promise<MfaEnrollmentState> {
  const admin = await getPendingMfaAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.mfaEnabledAt) redirect("/admin/mfa");
  if (!(await checkMfaRateLimit(admin.id))) return { error: rateLimitedMessage };

  const result = await confirmEnrollment(admin, formData.get("code"), actorLabel(admin));
  if (!result.ok) {
    if (result.reason === "expired") return { error: "O QR Code expirou. Recarregue a página para gerar um novo e escaneie novamente." };
    if (result.reason === "already_active") redirect("/admin/mfa");
    return { error: "Código inválido. Confira se o horário do celular está automático e tente o código atual." };
  }
  // The factor is active and the session is complete. The recovery codes are returned once, to be
  // displayed now; they are not stored anywhere in clear.
  const continueTo = await issueFullSession(admin, result.verifiedAt);
  return { recoveryCodes: result.recoveryCodes, continueTo };
}
