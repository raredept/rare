import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
  getPendingMfaAdmin: vi.fn(),
  signAdminSession: vi.fn(async () => "full-session"),
  setAdminSessionCookie: vi.fn(),
  clearAdminMfaPendingCookie: vi.fn(),
  checkMfaRateLimit: vi.fn(async () => true),
  verifyMfaChallenge: vi.fn(),
  confirmEnrollment: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  getPendingMfaAdmin: mocks.getPendingMfaAdmin,
  signAdminSession: mocks.signAdminSession,
  setAdminSessionCookie: mocks.setAdminSessionCookie,
  clearAdminMfaPendingCookie: mocks.clearAdminMfaPendingCookie,
}));
vi.mock("@/lib/admin-mfa", () => ({
  checkMfaRateLimit: mocks.checkMfaRateLimit,
  verifyMfaChallenge: mocks.verifyMfaChallenge,
  confirmEnrollment: mocks.confirmEnrollment,
}));

const verifiedAt = new Date("2026-11-06T15:00:00Z");
function pending(overrides: Record<string, unknown> = {}) {
  return { id: "admin_1", email: "admin@rare.test", username: null, mustChangePassword: false, mfaEnabledAt: verifiedAt, next: "/admin/orders", ...overrides };
}
function form(code: string) {
  const data = new FormData();
  data.set("code", code);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPendingMfaAdmin.mockResolvedValue(pending());
  mocks.checkMfaRateLimit.mockResolvedValue(true);
});

describe("MFA challenge action", () => {
  it("sends anyone without a fresh password step back to the login", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(null);
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("123456"))).rejects.toThrow("NEXT_REDIRECT:/admin/login");
    expect(mocks.verifyMfaChallenge).not.toHaveBeenCalled();
    expect(mocks.setAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("sends a not-yet-enrolled account to the mandatory enrollment", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(pending({ mfaEnabledAt: null }));
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("123456"))).rejects.toThrow("NEXT_REDIRECT:/admin/mfa/setup");
  });

  it("stops brute force before checking the code", async () => {
    mocks.checkMfaRateLimit.mockResolvedValueOnce(false);
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("123456"))).resolves.toEqual({ error: expect.stringContaining("Muitas tentativas") });
    expect(mocks.verifyMfaChallenge).not.toHaveBeenCalled();
  });

  it("issues no session for a wrong or replayed code", async () => {
    mocks.verifyMfaChallenge.mockResolvedValueOnce({ ok: false, reason: "invalid" }).mockResolvedValueOnce({ ok: false, reason: "replay" });
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("000000"))).resolves.toEqual({ error: expect.stringContaining("Código inválido") });
    await expect(verifyMfaAction({}, form("000000"))).resolves.toEqual({ error: expect.stringContaining("já foi usado") });
    expect(mocks.setAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("issues the full session with the MFA claim and returns to the safe next", async () => {
    mocks.verifyMfaChallenge.mockResolvedValueOnce({ ok: true, method: "totp", verifiedAt });
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("123456"))).rejects.toThrow("NEXT_REDIRECT:/admin/orders");
    expect(mocks.signAdminSession).toHaveBeenCalledWith(expect.objectContaining({ id: "admin_1" }), { mfaVerifiedAt: verifiedAt });
    expect(mocks.setAdminSessionCookie).toHaveBeenCalledWith("full-session");
    expect(mocks.clearAdminMfaPendingCookie).toHaveBeenCalled();
  });

  it("ignores a hostile next stored in the pending credential", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(pending({ next: "/admin/../..//evil.example" }));
    mocks.verifyMfaChallenge.mockResolvedValueOnce({ ok: true, method: "totp", verifiedAt });
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("123456"))).rejects.toThrow("NEXT_REDIRECT:/admin");
  });

  it("still forces the temporary password change after MFA", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(pending({ mustChangePassword: true }));
    mocks.verifyMfaChallenge.mockResolvedValueOnce({ ok: true, method: "recovery_code", verifiedAt });
    const { verifyMfaAction } = await import("@/app/admin/mfa/actions");
    await expect(verifyMfaAction({}, form("ABCDE-FGH23"))).rejects.toThrow("NEXT_REDIRECT:/admin/change-password");
  });
});

describe("MFA enrollment action", () => {
  it("requires the pending credential", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(null);
    const { confirmEnrollmentAction } = await import("@/app/admin/mfa/actions");
    await expect(confirmEnrollmentAction({}, form("123456"))).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("does not let an already enrolled account enroll again (would replace the factor)", async () => {
    const { confirmEnrollmentAction } = await import("@/app/admin/mfa/actions");
    await expect(confirmEnrollmentAction({}, form("123456"))).rejects.toThrow("NEXT_REDIRECT:/admin/mfa");
    expect(mocks.confirmEnrollment).not.toHaveBeenCalled();
  });

  it("issues no session for a wrong code", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(pending({ mfaEnabledAt: null }));
    mocks.confirmEnrollment.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    const { confirmEnrollmentAction } = await import("@/app/admin/mfa/actions");
    await expect(confirmEnrollmentAction({}, form("000000"))).resolves.toEqual({ error: expect.stringContaining("Código inválido") });
    expect(mocks.setAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("returns the one-time recovery codes and completes the session", async () => {
    mocks.getPendingMfaAdmin.mockResolvedValueOnce(pending({ mfaEnabledAt: null }));
    mocks.confirmEnrollment.mockResolvedValueOnce({ ok: true, recoveryCodes: ["AAAAA-BBBBB"], verifiedAt });
    const { confirmEnrollmentAction } = await import("@/app/admin/mfa/actions");
    await expect(confirmEnrollmentAction({}, form("123456"))).resolves.toEqual({ recoveryCodes: ["AAAAA-BBBBB"], continueTo: "/admin/orders" });
    expect(mocks.signAdminSession).toHaveBeenCalledWith(expect.anything(), { mfaVerifiedAt: verifiedAt });
    expect(mocks.clearAdminMfaPendingCookie).toHaveBeenCalled();
  });
});
