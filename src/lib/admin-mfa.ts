import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { recordAdminAudit } from "@/lib/admin-audit";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  openMfaSecret,
  sealMfaSecret,
} from "@/lib/admin-mfa-crypto";
import { getActionClientIp } from "@/lib/login-guard";
import { rateLimit } from "@/lib/rate-limit";
import { buildOtpAuthUri, generateTotpSecret, verifyTotp } from "@/lib/totp";

// Server-side MFA flows for Admin accounts: enrollment, challenge, recovery codes and reset.
// Nothing here ever logs, returns or stores a TOTP secret or a recovery code in clear, except the
// enrollment screen (secret, to the person enrolling) and the one-time recovery code list.

export const MFA_ISSUER = "RARE Admin";
/** A pending enrollment is regenerated after this, so an abandoned QR stops being usable. */
export const MFA_ENROLLMENT_TTL_MS = 15 * 60_000;

type MfaUser = {
  id: string;
  email: string;
  mfaEnabledAt: Date | null;
  mfaSecretEncrypted: string | null;
  mfaLastUsedStep: number | null;
  mfaPendingSecretEncrypted: string | null;
  mfaPendingCreatedAt: Date | null;
};

/**
 * Brute-force ceiling for 6-digit codes, separate from the password limiter. Windows are short
 * and nothing locks permanently, so an attacker cannot turn it into a lasting denial of service:
 *  - per account and client address: 5 per 5 min,
 *  - per client address: 20 per 5 min (spraying several accounts),
 *  - per account overall: 30 per hour (distributed guessing; ~0.01% success per hour).
 */
export async function checkMfaRateLimit(userId: string) {
  const ip = await getActionClientIp();
  const results = await Promise.all([
    rateLimit(`admin-mfa:${userId}:${ip}`, 5, 5 * 60_000),
    rateLimit(`admin-mfa-ip:${ip}`, 20, 5 * 60_000),
    rateLimit(`admin-mfa-account:${userId}`, 30, 60 * 60_000),
  ]);
  return results.every((result) => result.ok);
}

export type MfaEnrollmentView = {
  secret: string;
  otpauthUri: string;
  qrSvg: string;
  expiresAt: Date;
};

/** Returns the enrollment in progress, creating (or renewing an expired) one. Never touches an active factor. */
export async function ensurePendingEnrollment(user: MfaUser, now = new Date()): Promise<MfaEnrollmentView> {
  if (user.mfaEnabledAt) throw new Error("MFA_ALREADY_ACTIVE");

  let secret: string | null = null;
  let createdAt = user.mfaPendingCreatedAt;
  if (user.mfaPendingSecretEncrypted && createdAt && now.getTime() - createdAt.getTime() < MFA_ENROLLMENT_TTL_MS) {
    try {
      secret = openMfaSecret(user.mfaPendingSecretEncrypted, user.id);
    } catch {
      secret = null;
    }
  }
  if (!secret) {
    secret = generateTotpSecret();
    createdAt = now;
    const updated = await prisma.user.updateMany({
      where: { id: user.id, mfaEnabledAt: null },
      data: { mfaPendingSecretEncrypted: sealMfaSecret(secret, user.id), mfaPendingCreatedAt: now },
    });
    if (updated.count !== 1) throw new Error("MFA_ALREADY_ACTIVE");
  }

  const otpauthUri = buildOtpAuthUri({ secret, accountName: user.email, issuer: MFA_ISSUER });
  const qrSvg = await QRCode.toString(otpauthUri, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
  return { secret, otpauthUri, qrSvg, expiresAt: new Date((createdAt as Date).getTime() + MFA_ENROLLMENT_TTL_MS) };
}

async function replaceRecoveryCodes(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string) {
  const codes = generateRecoveryCodes();
  await tx.adminMfaRecoveryCode.deleteMany({ where: { userId } });
  await tx.adminMfaRecoveryCode.createMany({
    data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(normalizeRecoveryCode(code) as string) })),
  });
  return codes;
}

export type ConfirmEnrollmentResult =
  | { ok: true; recoveryCodes: string[]; verifiedAt: Date }
  | { ok: false; reason: "expired" | "invalid" | "already_active" };

/**
 * Activates the pending secret only after a code generated from it is verified. The update is
 * conditional on the exact pending value, so a parallel renewal or a second confirmation cannot
 * activate a different secret than the one this code proves.
 */
export async function confirmEnrollment(user: MfaUser, code: unknown, actorLabel: string, now = new Date()): Promise<ConfirmEnrollmentResult> {
  if (user.mfaEnabledAt) return { ok: false, reason: "already_active" };
  const sealed = user.mfaPendingSecretEncrypted;
  if (!sealed || !user.mfaPendingCreatedAt || now.getTime() - user.mfaPendingCreatedAt.getTime() >= MFA_ENROLLMENT_TTL_MS) {
    return { ok: false, reason: "expired" };
  }
  let secret: string;
  try {
    secret = openMfaSecret(sealed, user.id);
  } catch {
    return { ok: false, reason: "expired" };
  }
  const verification = verifyTotp({ secret, code, nowMs: now.getTime(), lastUsedStep: null });
  if (!verification.ok) return { ok: false, reason: "invalid" };

  const recoveryCodes = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: user.id, mfaEnabledAt: null, mfaPendingSecretEncrypted: sealed },
      data: {
        mfaSecretEncrypted: sealed,
        mfaEnabledAt: now,
        mfaLastUsedStep: verification.step,
        mfaPendingSecretEncrypted: null,
        mfaPendingCreatedAt: null,
      },
    });
    if (updated.count !== 1) return null;
    const codes = await replaceRecoveryCodes(tx, user.id);
    await recordAdminAudit(tx, {
      actor: { id: user.id, label: actorLabel },
      action: "mfa.enrolled",
      entityType: "User",
      entityId: user.id,
      after: { mfaEnabledAt: now, recoveryCodesIssued: codes.length },
    });
    return codes;
  });
  if (!recoveryCodes) return { ok: false, reason: "already_active" };
  return { ok: true, recoveryCodes, verifiedAt: now };
}

export type MfaChallengeResult =
  | { ok: true; method: "totp" | "recovery_code"; verifiedAt: Date }
  | { ok: false; reason: "not_enrolled" | "invalid" | "replay" };

async function consumeTotp(user: MfaUser, code: unknown, now: Date): Promise<MfaChallengeResult> {
  if (!user.mfaSecretEncrypted || !user.mfaEnabledAt) return { ok: false, reason: "not_enrolled" };
  let secret: string;
  try {
    secret = openMfaSecret(user.mfaSecretEncrypted, user.id);
  } catch {
    // Wrong/rotated key or tampered value: fail closed. Recovery codes or a reset still work.
    return { ok: false, reason: "invalid" };
  }
  const verification = verifyTotp({ secret, code, nowMs: now.getTime(), lastUsedStep: user.mfaLastUsedStep });
  if (!verification.ok) return { ok: false, reason: verification.reason === "replay" ? "replay" : "invalid" };
  // Atomic: two requests carrying the same code race here and only one advances the step.
  const updated = await prisma.user.updateMany({
    where: {
      id: user.id,
      mfaSecretEncrypted: user.mfaSecretEncrypted,
      OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: verification.step } }],
    },
    data: { mfaLastUsedStep: verification.step },
  });
  if (updated.count !== 1) return { ok: false, reason: "replay" };
  return { ok: true, method: "totp", verifiedAt: now };
}

async function consumeRecoveryCode(user: MfaUser, code: string, actorLabel: string, now: Date): Promise<MfaChallengeResult> {
  if (!user.mfaEnabledAt) return { ok: false, reason: "not_enrolled" };
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return { ok: false, reason: "invalid" };
  const codeHash = hashRecoveryCode(normalized);
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.adminMfaRecoveryCode.updateMany({
      where: { userId: user.id, codeHash, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return { ok: false as const, reason: "invalid" as const };
    const remaining = await tx.adminMfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
    await recordAdminAudit(tx, {
      actor: { id: user.id, label: actorLabel },
      action: "mfa.recovery_code_used",
      entityType: "User",
      entityId: user.id,
      after: { remainingRecoveryCodes: remaining },
    });
    return { ok: true as const, method: "recovery_code" as const, verifiedAt: now };
  });
}

/** Second step of the login: a 6-digit TOTP code, or one of the single-use recovery codes. */
export async function verifyMfaChallenge(user: MfaUser, input: unknown, actorLabel: string, now = new Date()): Promise<MfaChallengeResult> {
  if (typeof input !== "string") return { ok: false, reason: "invalid" };
  const compact = input.replace(/\s/g, "");
  if (/^\d{6}$/.test(compact)) return consumeTotp(user, compact, now);
  return consumeRecoveryCode(user, input, actorLabel, now);
}

/** New recovery codes, only after a fresh TOTP code. The previous set stops working. */
export async function regenerateRecoveryCodes(user: MfaUser, totpCode: unknown, actorLabel: string, now = new Date()) {
  const check = await consumeTotp(user, totpCode, now);
  if (!check.ok) return { ok: false as const, reason: check.reason };
  const recoveryCodes = await prisma.$transaction(async (tx) => {
    const codes = await replaceRecoveryCodes(tx, user.id);
    await recordAdminAudit(tx, {
      actor: { id: user.id, label: actorLabel },
      action: "mfa.recovery_codes_regenerated",
      entityType: "User",
      entityId: user.id,
      after: { recoveryCodesIssued: codes.length },
    });
    return codes;
  });
  return { ok: true as const, recoveryCodes };
}

export async function countUnusedRecoveryCodes(userId: string) {
  return prisma.adminMfaRecoveryCode.count({ where: { userId, usedAt: null } });
}

/**
 * High-risk operation, for an operator with database access (see docs/runbooks): removes the
 * factor, every recovery code and every session of the account. The next login goes through
 * enrollment again. Recorded in the audit log.
 */
export async function resetAdminMfa(userId: string, actorLabel: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: { id: true, role: true, mfaEnabledAt: true } });
    if (!before || before.role !== "ADMIN") throw new Error("ADMIN_NOT_FOUND");
    await tx.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        mfaLastUsedStep: null,
        mfaPendingSecretEncrypted: null,
        mfaPendingCreatedAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    const removed = await tx.adminMfaRecoveryCode.deleteMany({ where: { userId } });
    await recordAdminAudit(tx, {
      actor: { id: null, label: actorLabel },
      action: "mfa.reset",
      entityType: "User",
      entityId: userId,
      before: { mfaEnabledAt: before.mfaEnabledAt },
      after: { mfaEnabledAt: null, recoveryCodesRemoved: removed.count, sessionsRevoked: true, reason: reason.slice(0, 200) },
    });
    // Visible in the Admin bell for every administrator, not only in the database.
    await tx.adminNotification.createMany({
      data: [{ type: "security_mfa_reset", title: "Segundo fator redefinido", body: "A verificação em duas etapas de uma conta Admin foi redefinida por procedimento técnico. Confirme que foi autorizado.", href: "/admin/security", dedupeKey: `mfa-reset:${userId}:${Date.now()}` }],
    });
    return { recoveryCodesRemoved: removed.count };
  });
}
