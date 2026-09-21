import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete })),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env", () => ({
  getAdminSessionSecret: () => "test-admin-session-secret-with-more-than-32-characters",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin authorization", () => {
  it("keeps the password-change requirement in newly issued sessions", async () => {
    const { signAdminSession, verifyAdminSession } = await import("@/lib/auth");
    const token = await signAdminSession({
      id: "admin-2",
      email: "admin-2@raredept.local",
      role: "ADMIN",
      mustChangePassword: true,
      passwordHash: "temporary-password-hash",
      sessionVersion: 0,
    });

    await expect(verifyAdminSession(token)).resolves.toMatchObject({
      sub: "admin-2",
      email: "admin-2@raredept.local",
      role: "ADMIN",
      mustChangePassword: true,
      credentialVersion: expect.any(String),
    });
  });

  it("blocks every regular admin authorization while password change is pending", async () => {
    const { signAdminSession, requireAdmin } = await import("@/lib/auth");
    const token = await signAdminSession({
      id: "admin-2",
      email: "admin-2@raredept.local",
      role: "ADMIN",
      mustChangePassword: true,
      passwordHash: "temporary-password-hash",
      sessionVersion: 0,
    });
    mocks.cookieGet.mockReturnValue({ value: token });
    mocks.findFirst.mockResolvedValue({
      id: "admin-2",
      name: "ADMIN 2",
      email: "admin-2@raredept.local",
      username: "ADMIN 2",
      role: "ADMIN",
      mustChangePassword: true,
      passwordHash: "temporary-password-hash",
      sessionVersion: 0,
    });

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/admin/change-password");
  });

  it("continues to authorize an existing administrator without the requirement", async () => {
    const { signAdminSession, requireAdmin } = await import("@/lib/auth");
    const token = await signAdminSession({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: "existing-password-hash",
      sessionVersion: 0,
    });
    mocks.cookieGet.mockReturnValue({ value: token });
    const existingAdmin = {
      id: "admin-1",
      name: "Administrador",
      email: "admin@example.com",
      username: null,
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: "existing-password-hash",
      sessionVersion: 0,
    };
    mocks.findFirst.mockResolvedValue(existingAdmin);

    await expect(requireAdmin()).resolves.toEqual({
      id: existingAdmin.id,
      name: existingAdmin.name,
      email: existingAdmin.email,
      username: existingAdmin.username,
      role: existingAdmin.role,
      mustChangePassword: existingAdmin.mustChangePassword,
      sessionVersion: 0,
    });
  });

  it("invalidates older sessions after the password hash changes", async () => {
    const { signAdminSession, getCurrentAdmin, requireAdmin } = await import("@/lib/auth");
    const token = await signAdminSession({
      id: "admin-2",
      email: "admin-2@raredept.local",
      role: "ADMIN",
      mustChangePassword: true,
      passwordHash: "temporary-password-hash",
      sessionVersion: 0,
    });
    mocks.cookieGet.mockReturnValue({ value: token });
    mocks.findFirst.mockResolvedValue({
      id: "admin-2",
      name: "ADMIN 2",
      email: "admin-2@raredept.local",
      username: "ADMIN 2",
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: "new-password-hash",
      sessionVersion: 0,
    });

    await expect(getCurrentAdmin()).resolves.toBeNull();
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("never accepts a customer session, or a token signed with another secret, as an administrator", async () => {
    const { SignJWT } = await import("jose");
    const { verifyAdminSession } = await import("@/lib/auth");
    const secret = new TextEncoder().encode("test-admin-session-secret-with-more-than-32-characters");
    const forge = (role: string, key: Uint8Array) =>
      new SignJWT({ email: "someone@example.com", role, credentialVersion: "x" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setExpirationTime("1h")
        .sign(key);

    await expect(verifyAdminSession(await forge("CUSTOMER", secret))).resolves.toBeNull();
    await expect(verifyAdminSession(await forge("ADMIN", new TextEncoder().encode("another-secret-another-secret-another-secret")))).resolves.toBeNull();
    await expect(verifyAdminSession(await forge("ADMIN", secret))).resolves.toMatchObject({ role: "ADMIN", sub: "user-1" });
  });

  it("rejects a session issued before the account logged out", async () => {
    const { signAdminSession, getCurrentAdmin } = await import("@/lib/auth");
    const admin = {
      id: "admin-1",
      name: "Administrador",
      email: "admin@example.com",
      username: null,
      role: "ADMIN" as const,
      mustChangePassword: false,
      passwordHash: "existing-password-hash",
    };
    const token = await signAdminSession({ ...admin, sessionVersion: 3 });
    mocks.cookieGet.mockReturnValue({ value: token });

    mocks.findFirst.mockResolvedValue({ ...admin, sessionVersion: 3 });
    await expect(getCurrentAdmin()).resolves.toMatchObject({ id: "admin-1" });

    mocks.findFirst.mockResolvedValue({ ...admin, sessionVersion: 4 });
    await expect(getCurrentAdmin()).resolves.toBeNull();
  });

  it("treats a token issued before sessionVersion existed as version 0, so the deploy logs no one out", async () => {
    const { SignJWT } = await import("jose");
    const { verifyAdminSession } = await import("@/lib/auth");
    const secret = new TextEncoder().encode("test-admin-session-secret-with-more-than-32-characters");
    const legacy = await new SignJWT({ email: "a@example.com", role: "ADMIN", credentialVersion: "x", mustChangePassword: false })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-1")
      .setExpirationTime("1h")
      .sign(secret);
    const malformed = await new SignJWT({ email: "a@example.com", role: "ADMIN", credentialVersion: "x", sessionVersion: "1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-1")
      .setExpirationTime("1h")
      .sign(secret);

    await expect(verifyAdminSession(legacy)).resolves.toMatchObject({ sessionVersion: 0 });
    await expect(verifyAdminSession(malformed)).resolves.toBeNull();
  });

  it("revokes every session of the account on logout and clears the cookie", async () => {
    const { signAdminSession, endAdminSession } = await import("@/lib/auth");
    const token = await signAdminSession({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: "existing-password-hash",
      sessionVersion: 2,
    });
    mocks.cookieGet.mockReturnValue({ value: token });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await endAdminSession();

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "admin-1", sessionVersion: 2 },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("rare_admin_session");
  });

  it("does not touch the database for a missing or forged token, and still clears the cookie", async () => {
    const { endAdminSession } = await import("@/lib/auth");
    mocks.cookieGet.mockReturnValue({ value: "not-a-jwt" });

    await endAdminSession();

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).toHaveBeenCalledWith("rare_admin_session");
  });

  it("clears the cookie even when the revocation write fails", async () => {
    const { signAdminSession, endAdminSession } = await import("@/lib/auth");
    const token = await signAdminSession({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      mustChangePassword: false,
      passwordHash: "existing-password-hash",
      sessionVersion: 0,
    });
    mocks.cookieGet.mockReturnValue({ value: token });
    mocks.updateMany.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(endAdminSession()).resolves.toBeUndefined();

    expect(mocks.cookieDelete).toHaveBeenCalledWith("rare_admin_session");
    expect(consoleError).toHaveBeenCalledWith("[auth] could not revoke admin sessions on logout", "Error");
    consoleError.mockRestore();
  });
});
