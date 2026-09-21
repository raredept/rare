import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  setAdminSessionCookie: vi.fn(),
  signAdminSession: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  getCurrentAdmin: mocks.getCurrentAdmin,
  setAdminSessionCookie: mocks.setAdminSessionCookie,
  signAdminSession: mocks.signAdminSession,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { updateMany: mocks.updateMany } },
}));

function passwordForm(password: string, confirmation = password) {
  const formData = new FormData();
  formData.set("password", password);
  formData.set("passwordConfirmation", confirmation);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({
    id: "admin-2",
    name: "ADMIN 2",
    email: "admin-2@raredept.local",
    username: "ADMIN 2",
    role: "ADMIN",
    mustChangePassword: true,
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.signAdminSession.mockResolvedValue("new-session-token");
});

describe("forced admin password change", () => {
  it("replaces the temporary password, clears the requirement and opens the admin", async () => {
    const { changePasswordAction } = await import("@/app/admin/change-password/actions");
    const newPassword = "NovaSenhaSegura2";

    await expect(changePasswordAction({}, passwordForm(newPassword)))
      .rejects.toThrow("NEXT_REDIRECT:/admin?success=password-updated");

    const update = mocks.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: "admin-2",
      role: "ADMIN",
      active: true,
      mustChangePassword: true,
    });
    expect(update.data.mustChangePassword).toBe(false);
    await expect(bcrypt.compare(newPassword, update.data.passwordHash)).resolves.toBe(true);
    await expect(bcrypt.compare("ADMIN", update.data.passwordHash)).resolves.toBe(false);
    expect(mocks.setAdminSessionCookie).toHaveBeenCalledWith("new-session-token");
  });

  it("rejects weak passwords without changing the account", async () => {
    const { changePasswordAction } = await import("@/app/admin/change-password/actions");

    await expect(changePasswordAction({}, passwordForm("ADMIN"))).resolves.toEqual({
      error: "A nova senha deve ter pelo menos 12 caracteres.",
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    "Aa1" + "x".repeat(70),
    "Aa1" + "á".repeat(35),
  ])("rejects new passwords that bcrypt would truncate", async (password) => {
    const { changePasswordAction } = await import("@/app/admin/change-password/actions");

    await expect(changePasswordAction({}, passwordForm(password))).resolves.toEqual({
      error: "A nova senha é longa demais. Use até 72 caracteres simples ou reduza os caracteres especiais.",
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.setAdminSessionCookie).not.toHaveBeenCalled();
  });

  it("does not expose the password-change flow to an administrator already released", async () => {
    mocks.getCurrentAdmin.mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      mustChangePassword: false,
    });
    const { changePasswordAction } = await import("@/app/admin/change-password/actions");

    await expect(changePasswordAction({}, passwordForm("NovaSenhaSegura2")))
      .rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
