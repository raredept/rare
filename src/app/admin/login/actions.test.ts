import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  rateLimit: vi.fn(),
  signAdminSession: vi.fn(),
  setAdminSessionCookie: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/auth", () => ({
  signAdminSession: mocks.signAdminSession,
  setAdminSessionCookie: mocks.setAdminSessionCookie,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.findFirst } } }));

function loginForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("email", "admin@example.com");
  formData.set("password", "password123");
  formData.set("next", "/admin/produtos");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.findFirst.mockResolvedValue({
    id: "admin_1",
    email: "admin@example.com",
    username: null,
    passwordHash: "hashed-password",
    role: "ADMIN",
    active: true,
    mustChangePassword: false,
  });
  mocks.compare.mockResolvedValue(true);
  mocks.signAdminSession.mockResolvedValue("admin-token");
});

describe("admin login action", () => {
  it("authenticates an active administrator and uses an allowlisted redirect", async () => {
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm())).rejects.toThrow("NEXT_REDIRECT:/admin/produtos");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        active: true,
        OR: [
          { email: { equals: "admin@example.com", mode: "insensitive" } },
          { username: { equals: "admin@example.com", mode: "insensitive" } },
        ],
      },
    });
    expect(mocks.setAdminSessionCookie).toHaveBeenCalledWith("admin-token");
  });

  it("sends an administrator with a temporary password only to the password-change page", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "admin_2",
      email: "admin-2@raredept.local",
      username: "ADMIN 2",
      passwordHash: "temporary-hash",
      role: "ADMIN",
      active: true,
      mustChangePassword: true,
    });
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm({ email: "  ADMIN 2  ", password: "ADMIN" })))
      .rejects.toThrow("NEXT_REDIRECT:/admin/change-password");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        active: true,
        OR: [
          { email: { equals: "admin 2", mode: "insensitive" } },
          { username: { equals: "admin 2", mode: "insensitive" } },
        ],
      },
    });
    expect(mocks.setAdminSessionCookie).toHaveBeenCalledWith("admin-token");
  });

  it("returns a controlled error for invalid credentials", async () => {
    mocks.compare.mockResolvedValueOnce(false);
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm())).resolves.toEqual({ error: "Credenciais inválidas." });
    expect(mocks.setAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("does not authenticate a non-admin or inactive account", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm())).resolves.toEqual({ error: "Credenciais inválidas." });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        active: true,
        OR: [
          { email: { equals: "admin@example.com", mode: "insensitive" } },
          { username: { equals: "admin@example.com", mode: "insensitive" } },
        ],
      },
    });
    // An unknown account still spends one bcrypt comparison so response time
    // does not reveal whether the login exists.
    expect(mocks.compare).toHaveBeenCalledTimes(1);
    expect(mocks.setAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("never authenticates an unknown account even if the comparison reports a match", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    mocks.compare.mockResolvedValue(true);
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm())).resolves.toEqual({ error: "Credenciais inválidas." });
    expect(mocks.signAdminSession).not.toHaveBeenCalled();
  });

  it("applies per-identifier, per-address and per-account limits", async () => {
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm())).rejects.toThrow("NEXT_REDIRECT");
    const keys = mocks.rateLimit.mock.calls.map((call) => String(call[0]));
    expect(keys).toEqual(expect.arrayContaining([
      "admin-login:admin@example.com:local",
      "admin-login-ip:local",
      "admin-login-account:admin@example.com",
    ]));
  });

  it("blocks the attempt when any limit is exhausted", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm())).resolves.toEqual({ error: "Muitas tentativas. Tente novamente em alguns minutos." });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload before rate limiting or database access", async () => {
    const { loginAction } = await import("@/app/admin/login/actions");

    await expect(loginAction({}, loginForm({ email: "", password: "" })))
      .resolves.toEqual({ error: "Informe login e senha validos." });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
