import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashRecoveryCode, normalizeRecoveryCode, openMfaSecret, sealMfaSecret } from "@/lib/admin-mfa-crypto";
import { base32Decode, hotp, totpStep } from "@/lib/totp";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    adminMfaRecoveryCode: { deleteMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    adminAuditLog: { create: vi.fn() },
    adminNotification: { createMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      user: { updateMany: vi.fn() },
      adminMfaRecoveryCode: { count: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/login-guard", () => ({ getActionClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));

const originalKey = process.env.ADMIN_MFA_ENCRYPTION_KEY;
beforeAll(() => { process.env.ADMIN_MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });
afterAll(() => {
  if (originalKey === undefined) delete process.env.ADMIN_MFA_ENCRYPTION_KEY;
  else process.env.ADMIN_MFA_ENCRYPTION_KEY = originalKey;
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.adminMfaRecoveryCode.count.mockResolvedValue(9);
});

const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const now = new Date("2026-11-06T15:00:00Z");
const codeAt = (date: Date, offsetSteps = 0) => hotp(base32Decode(SECRET), totpStep(date.getTime()) + offsetSteps);

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: "admin@rare.test",
    mfaEnabledAt: null as Date | null,
    mfaSecretEncrypted: null as string | null,
    mfaLastUsedStep: null as number | null,
    mfaPendingSecretEncrypted: null as string | null,
    mfaPendingCreatedAt: null as Date | null,
    ...overrides,
  };
}

describe("MFA enrollment", () => {
  it("creates a sealed pending secret and a QR, without activating anything", async () => {
    const { ensurePendingEnrollment } = await import("@/lib/admin-mfa");
    const view = await ensurePendingEnrollment(baseUser(), now);
    expect(view.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(view.otpauthUri).toContain("otpauth://totp/");
    expect(view.qrSvg).toContain("<svg");
    const call = mocks.prisma.user.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "admin_1", mfaEnabledAt: null });
    expect(Object.keys(call.data).sort()).toEqual(["mfaPendingCreatedAt", "mfaPendingSecretEncrypted"]);
    expect(call.data.mfaPendingSecretEncrypted).not.toContain(view.secret);
    expect(openMfaSecret(call.data.mfaPendingSecretEncrypted, "admin_1")).toBe(view.secret);
  });

  it("reuses a fresh pending secret instead of rotating the QR on every reload", async () => {
    const { ensurePendingEnrollment } = await import("@/lib/admin-mfa");
    const pending = sealMfaSecret(SECRET, "admin_1");
    const view = await ensurePendingEnrollment(baseUser({ mfaPendingSecretEncrypted: pending, mfaPendingCreatedAt: new Date(now.getTime() - 60_000) }), now);
    expect(view.secret).toBe(SECRET);
    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("never enrolls on top of an active factor", async () => {
    const { ensurePendingEnrollment } = await import("@/lib/admin-mfa");
    await expect(ensurePendingEnrollment(baseUser({ mfaEnabledAt: now }), now)).rejects.toThrow("MFA_ALREADY_ACTIVE");
  });

  it("rejects a wrong confirmation code and leaves MFA inactive", async () => {
    const { confirmEnrollment } = await import("@/lib/admin-mfa");
    const user = baseUser({ mfaPendingSecretEncrypted: sealMfaSecret(SECRET, "admin_1"), mfaPendingCreatedAt: now });
    await expect(confirmEnrollment(user, "000000", "admin", now)).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an expired enrollment", async () => {
    const { confirmEnrollment } = await import("@/lib/admin-mfa");
    const user = baseUser({ mfaPendingSecretEncrypted: sealMfaSecret(SECRET, "admin_1"), mfaPendingCreatedAt: new Date(now.getTime() - 16 * 60_000) });
    await expect(confirmEnrollment(user, codeAt(now), "admin", now)).resolves.toEqual({ ok: false, reason: "expired" });
  });

  it("activates exactly the confirmed secret, issues hashed recovery codes and audits", async () => {
    const { confirmEnrollment } = await import("@/lib/admin-mfa");
    const sealed = sealMfaSecret(SECRET, "admin_1");
    const result = await confirmEnrollment(baseUser({ mfaPendingSecretEncrypted: sealed, mfaPendingCreatedAt: now }), codeAt(now), "admin", now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recoveryCodes).toHaveLength(10);
    const activation = mocks.tx.user.updateMany.mock.calls[0][0];
    expect(activation.where).toEqual({ id: "admin_1", mfaEnabledAt: null, mfaPendingSecretEncrypted: sealed });
    expect(activation.data).toMatchObject({ mfaSecretEncrypted: sealed, mfaEnabledAt: now, mfaLastUsedStep: totpStep(now.getTime()), mfaPendingSecretEncrypted: null });
    const stored = mocks.tx.adminMfaRecoveryCode.createMany.mock.calls[0][0].data as Array<{ codeHash: string }>;
    expect(stored.map((row) => row.codeHash)).toEqual(result.recoveryCodes.map((code) => hashRecoveryCode(normalizeRecoveryCode(code) as string)));
    expect(JSON.stringify(stored)).not.toContain(result.recoveryCodes[0]);
    const audit = mocks.tx.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: "mfa.enrolled", entityId: "admin_1", after: { backupCodesIssued: 10 } });
    expect(JSON.stringify(audit)).not.toContain(SECRET);
    expect(JSON.stringify(audit)).not.toContain(result.recoveryCodes[0]);
  });

  it("does not activate when a concurrent renewal replaced the pending secret", async () => {
    const { confirmEnrollment } = await import("@/lib/admin-mfa");
    mocks.tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await confirmEnrollment(baseUser({ mfaPendingSecretEncrypted: sealMfaSecret(SECRET, "admin_1"), mfaPendingCreatedAt: now }), codeAt(now), "admin", now);
    expect(result).toEqual({ ok: false, reason: "already_active" });
    expect(mocks.tx.adminMfaRecoveryCode.createMany).not.toHaveBeenCalled();
  });
});

describe("MFA challenge", () => {
  const activeUser = (overrides: Record<string, unknown> = {}) => baseUser({ mfaEnabledAt: now, mfaSecretEncrypted: sealMfaSecret(SECRET, "admin_1"), ...overrides });

  it("accepts the current TOTP once and records its step atomically", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    const user = activeUser();
    await expect(verifyMfaChallenge(user, codeAt(now), "admin", now)).resolves.toMatchObject({ ok: true, method: "totp" });
    expect(mocks.prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "admin_1", mfaSecretEncrypted: user.mfaSecretEncrypted, OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: totpStep(now.getTime()) } }] },
      data: { mfaLastUsedStep: totpStep(now.getTime()) },
    });
  });

  it("refuses a wrong code", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    await expect(verifyMfaChallenge(activeUser(), "123456", "admin", now)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a replayed code (already accepted step)", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    const user = activeUser({ mfaLastUsedStep: totpStep(now.getTime()) });
    await expect(verifyMfaChallenge(user, codeAt(now), "admin", now)).resolves.toEqual({ ok: false, reason: "replay" });
    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("lets only one of two concurrent submissions of the same code through", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    mocks.prisma.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const user = activeUser();
    const results = await Promise.all([verifyMfaChallenge(user, codeAt(now), "admin", now), verifyMfaChallenge(user, codeAt(now), "admin", now)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results).toContainEqual({ ok: false, reason: "replay" });
  });

  it("refuses a code from a window that already expired", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    await expect(verifyMfaChallenge(activeUser(), codeAt(now, -3), "admin", now)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("fails closed when the sealed secret cannot be opened", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    await expect(verifyMfaChallenge(activeUser({ mfaSecretEncrypted: "v1.AAAA" }), codeAt(now), "admin", now)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("consumes a recovery code once and audits its use", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    mocks.tx.adminMfaRecoveryCode.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(verifyMfaChallenge(activeUser(), "abcde-fgh23", "admin", now)).resolves.toMatchObject({ ok: true, method: "recovery_code" });
    expect(mocks.tx.adminMfaRecoveryCode.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin_1", codeHash: hashRecoveryCode("ABCDEFGH23"), usedAt: null },
      data: { usedAt: now },
    });
    expect(mocks.tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ action: "mfa.recovery_code_used" });
    await expect(verifyMfaChallenge(activeUser(), "ABCDE-FGH23", "admin", now)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("does not accept anything for an account without an active factor", async () => {
    const { verifyMfaChallenge } = await import("@/lib/admin-mfa");
    await expect(verifyMfaChallenge(baseUser(), codeAt(now), "admin", now)).resolves.toEqual({ ok: false, reason: "not_enrolled" });
    await expect(verifyMfaChallenge(baseUser(), "ABCDE-FGH23", "admin", now)).resolves.toEqual({ ok: false, reason: "not_enrolled" });
  });
});

describe("recovery code regeneration and reset", () => {
  it("requires a fresh TOTP before replacing the codes", async () => {
    const { regenerateRecoveryCodes } = await import("@/lib/admin-mfa");
    const user = baseUser({ mfaEnabledAt: now, mfaSecretEncrypted: sealMfaSecret(SECRET, "admin_1") });
    await expect(regenerateRecoveryCodes(user, "000000", "admin", now)).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(mocks.tx.adminMfaRecoveryCode.deleteMany).not.toHaveBeenCalled();
    const result = await regenerateRecoveryCodes(user, codeAt(now), "admin", now);
    expect(result.ok).toBe(true);
    expect(mocks.tx.adminMfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin_1" } });
    expect(mocks.tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ action: "mfa.recovery_codes_regenerated" });
  });

  it("reset removes the factor, the codes and every session, and is audited", async () => {
    const { resetAdminMfa } = await import("@/lib/admin-mfa");
    mocks.tx.user.findUnique.mockResolvedValueOnce({ id: "admin_1", role: "ADMIN", mfaEnabledAt: now });
    mocks.tx.adminMfaRecoveryCode.deleteMany.mockResolvedValueOnce({ count: 7 });
    await expect(resetAdminMfa("admin_1", "cli", "lost phone")).resolves.toEqual({ recoveryCodesRemoved: 7 });
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: "admin_1" },
      data: expect.objectContaining({ mfaSecretEncrypted: null, mfaEnabledAt: null, mfaPendingSecretEncrypted: null, sessionVersion: { increment: 1 } }),
    });
    expect(mocks.tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ action: "mfa.reset", entityId: "admin_1", after: { backupCodesRemoved: 7, sessionsRevoked: true } });
    expect(mocks.tx.adminNotification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "security_mfa_reset" });
  });
});
