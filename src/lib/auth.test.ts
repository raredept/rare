import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  findFirst: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env", () => ({
  getAdminSessionSecret: () => "test-admin-session-secret-with-more-than-32-characters",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst } },
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
    };
    mocks.findFirst.mockResolvedValue(existingAdmin);

    await expect(requireAdmin()).resolves.toEqual({
      id: existingAdmin.id,
      name: existingAdmin.name,
      email: existingAdmin.email,
      username: existingAdmin.username,
      role: existingAdmin.role,
      mustChangePassword: existingAdmin.mustChangePassword,
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
});
