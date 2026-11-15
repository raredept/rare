import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_MFA_PENDING_COOKIE, ADMIN_SESSION_COOKIE } from "@/lib/auth-constants";

const secret = "test-admin-session-secret-with-more-than-32-characters";
const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (mocks.jar.has(name) ? { value: mocks.jar.get(name) } : undefined),
    set: (name: string, value: string) => mocks.jar.set(name, value),
    delete: (name: string | { name: string }) => mocks.jar.delete(typeof name === "string" ? name : name.name),
  })),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }) }));
vi.mock("@/lib/env", () => ({ getAdminSessionSecret: () => secret }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } } }));

const admin = {
  id: "admin_1",
  name: "Admin",
  email: "admin@rare.test",
  username: null,
  role: "ADMIN" as const,
  mustChangePassword: false,
  passwordHash: "$2b$12$hash",
  sessionVersion: 3,
  mfaEnabledAt: null as Date | null,
};

const originalRequired = process.env.ADMIN_MFA_REQUIRED;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.jar.clear();
  mocks.findFirst.mockResolvedValue(admin);
  process.env.ADMIN_MFA_REQUIRED = "true";
});

afterEach(() => {
  if (originalRequired === undefined) delete process.env.ADMIN_MFA_REQUIRED;
  else process.env.ADMIN_MFA_REQUIRED = originalRequired;
});

describe("Admin session and the second factor", () => {
  it("refuses a password-only session when MFA is required", async () => {
    const { getCurrentAdmin, signAdminSession } = await import("@/lib/auth");
    mocks.jar.set(ADMIN_SESSION_COOKIE, await signAdminSession(admin));
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("refuses a pre-MFA (legacy) token that has no MFA claim at all", async () => {
    const { getCurrentAdmin } = await import("@/lib/auth");
    const { createHash } = await import("node:crypto");
    const legacy = await new SignJWT({
      email: admin.email,
      role: "ADMIN",
      mustChangePassword: false,
      credentialVersion: createHash("sha256").update(admin.passwordHash).digest("hex"),
      sessionVersion: admin.sessionVersion,
    }).setProtectedHeader({ alg: "HS256" }).setSubject(admin.id).setIssuedAt().setExpirationTime("8h").sign(new TextEncoder().encode(secret));
    mocks.jar.set(ADMIN_SESSION_COOKIE, legacy);
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("accepts a session issued after a verified second factor", async () => {
    const { getCurrentAdmin, signAdminSession } = await import("@/lib/auth");
    const verifiedAt = new Date("2026-11-06T15:00:00Z");
    mocks.jar.set(ADMIN_SESSION_COOKIE, await signAdminSession(admin, { mfaVerifiedAt: verifiedAt }));
    await expect(getCurrentAdmin()).resolves.toMatchObject({ id: admin.id, mfaVerifiedAt: verifiedAt });
  });

  it("still demands MFA from an enrolled account where the flag would not", async () => {
    process.env.ADMIN_MFA_REQUIRED = "false";
    const { getCurrentAdmin, signAdminSession } = await import("@/lib/auth");
    mocks.findFirst.mockResolvedValue({ ...admin, mfaEnabledAt: new Date() });
    mocks.jar.set(ADMIN_SESSION_COOKIE, await signAdminSession(admin));
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("keeps the password-only flow where MFA is off and the account never enrolled", async () => {
    process.env.ADMIN_MFA_REQUIRED = "false";
    const { getCurrentAdmin, signAdminSession } = await import("@/lib/auth");
    mocks.jar.set(ADMIN_SESSION_COOKIE, await signAdminSession(admin));
    await expect(getCurrentAdmin()).resolves.toMatchObject({ id: admin.id, mfaVerifiedAt: null });
  });

  it("revokes MFA sessions after logout or an MFA reset (sessionVersion bump)", async () => {
    const { getCurrentAdmin, signAdminSession } = await import("@/lib/auth");
    mocks.jar.set(ADMIN_SESSION_COOKIE, await signAdminSession(admin, { mfaVerifiedAt: new Date() }));
    mocks.findFirst.mockResolvedValue({ ...admin, sessionVersion: admin.sessionVersion + 1 });
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("never accepts the pending MFA credential as an Admin session (copied into the session cookie)", async () => {
    const { getCurrentAdmin, signAdminMfaPendingToken, verifyAdminSession } = await import("@/lib/auth");
    const pending = await signAdminMfaPendingToken(admin, "/admin");
    await expect(verifyAdminSession(pending)).resolves.toBeNull();
    mocks.jar.set(ADMIN_SESSION_COOKIE, pending);
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("forged mfa claim without a valid signature is rejected", async () => {
    const { getCurrentAdmin } = await import("@/lib/auth");
    const forged = await new SignJWT({ typ: "admin", email: admin.email, role: "ADMIN", credentialVersion: "x", sessionVersion: 3, mfa: true, mfaAt: 1 })
      .setProtectedHeader({ alg: "HS256" }).setSubject(admin.id).setExpirationTime("8h").sign(new TextEncoder().encode("another-secret-with-more-than-32-characters!!"));
    mocks.jar.set(ADMIN_SESSION_COOKIE, forged);
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("does not accept a full Admin session as the pending MFA credential", async () => {
    const { getPendingMfaAdmin, signAdminSession } = await import("@/lib/auth");
    mocks.jar.set(ADMIN_MFA_PENDING_COOKIE, await signAdminSession(admin, { mfaVerifiedAt: new Date() }));
    await expect(getPendingMfaAdmin()).resolves.toBeNull();
  });

  it("binds the pending credential to the current password and session version", async () => {
    const { getPendingMfaAdmin, signAdminMfaPendingToken } = await import("@/lib/auth");
    mocks.jar.set(ADMIN_MFA_PENDING_COOKIE, await signAdminMfaPendingToken(admin, "/admin/orders"));
    await expect(getPendingMfaAdmin()).resolves.toMatchObject({ id: admin.id, next: "/admin/orders" });
    mocks.findFirst.mockResolvedValue({ ...admin, passwordHash: "$2b$12$changed" });
    await expect(getPendingMfaAdmin()).resolves.toBeNull();
    mocks.findFirst.mockResolvedValue({ ...admin, sessionVersion: 4 });
    await expect(getPendingMfaAdmin()).resolves.toBeNull();
  });

  it("logout clears both the session and a pending MFA credential", async () => {
    const { endAdminSession, signAdminMfaPendingToken, signAdminSession } = await import("@/lib/auth");
    mocks.jar.set(ADMIN_SESSION_COOKIE, await signAdminSession(admin, { mfaVerifiedAt: new Date() }));
    mocks.jar.set(ADMIN_MFA_PENDING_COOKIE, await signAdminMfaPendingToken(admin, "/admin"));
    await endAdminSession();
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: admin.id, sessionVersion: 3 }, data: { sessionVersion: { increment: 1 } } });
    expect(mocks.jar.size).toBe(0);
  });
});
