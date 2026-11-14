import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasAdminPermission, type AdminPermission, type AdminRole } from "@/lib/admin-permissions";

const mocks = vi.hoisted(() => ({
  role: "SELLER_ADMIN" as string,
  assignAdminRole: vi.fn(),
  createAdminUser: vi.fn(),
  setAdminUserActive: vi.fn(),
  revokeAdminUserSessions: vi.fn(),
  resetAdminUserMfa: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth", async () => {
  const { hasAdminPermission: allowed } = await vi.importActual<typeof import("@/lib/admin-permissions")>("@/lib/admin-permissions");
  return {
    requireAdmin: vi.fn(async (permission?: AdminPermission) => {
      if (permission && !allowed(mocks.role, permission)) throw new Error("NEXT_REDIRECT:/admin/sem-acesso");
      return { id: "actor-1", username: "operador", email: "operador@example.com", role: mocks.role };
    }),
  };
});
vi.mock("@/lib/admin-users", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin-users")>("@/lib/admin-users");
  return {
    AdminUserError: actual.AdminUserError,
    assignAdminRole: mocks.assignAdminRole,
    createAdminUser: mocks.createAdminUser,
    setAdminUserActive: mocks.setAdminUserActive,
    revokeAdminUserSessions: mocks.revokeAdminUserSessions,
    resetAdminUserMfa: mocks.resetAdminUserMfa,
  };
});

import {
  assignAdminRoleAction,
  createAdminUserAction,
  resetAdminUserMfaAction,
  revokeAdminUserSessionsAction,
  setAdminUserActiveAction,
} from "@/app/admin/(protected)/users/actions";
import { AdminUserError } from "@/lib/admin-users";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const calls = [
  () => createAdminUserAction({}, form({ name: "Nova conta", email: "nova@example.com", role: "SYSTEM_ADMIN" })),
  () => setAdminUserActiveAction(form({ userId: "target-1", active: "false" })),
  () => assignAdminRoleAction(form({ userId: "actor-1", role: "SYSTEM_ADMIN" })),
  () => revokeAdminUserSessionsAction(form({ userId: "target-1" })),
  () => resetAdminUserMfaAction(form({ userId: "target-1", reason: "perdeu o celular" })),
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "SYSTEM_ADMIN";
});

describe("user management Server Actions", () => {
  it.each(calls.map((call, index) => [index, call]))("refuses a SELLER_ADMIN before touching any account (action %i)", async (_index, call) => {
    mocks.role = "SELLER_ADMIN" satisfies AdminRole;
    expect(hasAdminPermission(mocks.role, "system.users")).toBe(false);
    await expect(call()).rejects.toThrow("NEXT_REDIRECT:/admin/sem-acesso");
    for (const fn of [mocks.assignAdminRole, mocks.createAdminUser, mocks.setAdminUserActive, mocks.revokeAdminUserSessions, mocks.resetAdminUserMfa]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each(["ADMIN", "CUSTOMER", "system_admin", ""])("never grants a role outside the allowlist from the payload (%s)", async (role) => {
    await expect(assignAdminRoleAction(form({ userId: "target-1", role }))).rejects.toThrow("NEXT_REDIRECT:/admin/users?error=admin-user-invalid");
    expect(mocks.assignAdminRole).not.toHaveBeenCalled();
  });

  it("assigns an allowlisted role and reports success", async () => {
    mocks.assignAdminRole.mockResolvedValue({ changed: true });
    await expect(assignAdminRoleAction(form({ userId: "target-1", role: "SELLER_ADMIN" }))).rejects.toThrow("success=admin-user-role-saved");
    expect(mocks.assignAdminRole).toHaveBeenCalledWith({ id: "actor-1", label: "operador" }, "target-1", "SELLER_ADMIN");
  });

  it("signs the operator out after changing their own role, since that revokes their session", async () => {
    mocks.assignAdminRole.mockResolvedValue({ changed: true });
    await expect(assignAdminRoleAction(form({ userId: "actor-1", role: "SYSTEM_ADMIN" }))).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });

  it("turns the last-manager guard into a visible error", async () => {
    mocks.setAdminUserActive.mockRejectedValue(new AdminUserError("last-system-admin"));
    await expect(setAdminUserActiveAction(form({ userId: "target-1", active: "false" }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/users?error=admin-user-last-system-admin",
    );
  });
});
