import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  txFindFirst: vi.fn(),
  txUpdate: vi.fn(),
  txCreate: vi.fn(),
  findFirst: vi.fn(),
  audit: vi.fn(),
  resetAdminMfa: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = { $queryRaw: mocks.queryRaw, user: { findFirst: mocks.txFindFirst, update: mocks.txUpdate, create: mocks.txCreate } };
  return { prisma: { user: { findFirst: mocks.findFirst }, $transaction: (run: (client: typeof tx) => unknown) => run(tx) } };
});
vi.mock("@/lib/admin-audit", () => ({ recordAdminAudit: mocks.audit }));
vi.mock("@/lib/admin-mfa", () => ({ resetAdminMfa: mocks.resetAdminMfa }));

import {
  AdminUserError,
  assignAdminRole,
  createAdminUser,
  maskEmail,
  resetAdminUserMfa,
  revokeAdminUserSessions,
  setAdminUserActive,
} from "@/lib/admin-users";

const actor = { id: "system-1", label: "sistema" };

function target(role: string, active = true) {
  mocks.txFindFirst.mockResolvedValue({ id: "target-1", role, active });
}

// A change that can remove a manager locks the active managers first, then the target row.
function activeManagers(...ids: string[]) {
  mocks.queryRaw.mockResolvedValueOnce(ids.map((id) => ({ id }))).mockResolvedValueOnce([]);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.queryRaw.mockResolvedValue([]);
});

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(AdminUserError);
  expect((error as AdminUserError).code).toBe(code);
}

describe("Admin user management", () => {
  it("refuses to demote the last active user manager", async () => {
    target("SYSTEM_ADMIN");
    activeManagers("target-1");
    await expectCode(assignAdminRole(actor, "target-1", "SELLER_ADMIN"), "last-system-admin");
    expect(mocks.txUpdate).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the last active user manager", async () => {
    target("ADMIN");
    activeManagers("target-1");
    await expectCode(setAdminUserActive(actor, "target-1", false), "last-system-admin");
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });

  it("demotes a manager when another active one remains, revoking sessions and auditing", async () => {
    target("SYSTEM_ADMIN");
    activeManagers("target-1", "system-1");
    await expect(assignAdminRole(actor, "target-1", "SELLER_ADMIN")).resolves.toEqual({ changed: true });
    expect(mocks.txUpdate).toHaveBeenCalledWith({ where: { id: "target-1" }, data: { role: "SELLER_ADMIN", sessionVersion: { increment: 1 } } });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actor,
      action: "admin_user.role_changed",
      entityId: "target-1",
      before: { role: "SYSTEM_ADMIN" },
      after: { role: "SELLER_ADMIN", sessionsRevoked: true },
    }));
  });

  it("takes the manager lock before the target lock, so concurrent demotions cannot deadlock", async () => {
    target("SYSTEM_ADMIN");
    activeManagers("target-1", "system-1");
    await assignAdminRole(actor, "target-1", "SELLER_ADMIN");
    const [managersQuery, targetQuery] = mocks.queryRaw.mock.calls.map((call) => (call[0] as string[]).join("?"));
    expect(managersQuery).toContain('ORDER BY "id"');
    expect(managersQuery).toContain("FOR UPDATE");
    expect(targetQuery).toContain('WHERE "id" = ?');
  });

  it("deactivating a seller never trips the last-manager rule", async () => {
    target("SELLER_ADMIN");
    activeManagers();
    await setAdminUserActive(actor, "target-1", false);
    expect(mocks.txUpdate).toHaveBeenCalledWith({ where: { id: "target-1" }, data: { active: false, sessionVersion: { increment: 1 } } });
  });

  it("does not need the manager lock when promoting a seller", async () => {
    target("SELLER_ADMIN");
    await expect(assignAdminRole(actor, "target-1", "SYSTEM_ADMIN")).resolves.toEqual({ changed: true });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the role does not change", async () => {
    target("SELLER_ADMIN");
    await expect(assignAdminRole(actor, "target-1", "SELLER_ADMIN")).resolves.toEqual({ changed: false });
    expect(mocks.txUpdate).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("never lets an operator move their own account out of user management", async () => {
    await expectCode(assignAdminRole(actor, "system-1", "SELLER_ADMIN"), "self-change");
    expect(mocks.txFindFirst).not.toHaveBeenCalled();
  });

  it("lets a legacy operator move their own account to SYSTEM_ADMIN", async () => {
    mocks.txFindFirst.mockResolvedValue({ id: "system-1", role: "ADMIN", active: true });
    await expect(assignAdminRole(actor, "system-1", "SYSTEM_ADMIN")).resolves.toEqual({ changed: true });
  });

  it("refuses self-deactivation, self-revocation and self MFA reset", async () => {
    await expectCode(setAdminUserActive(actor, "system-1", false), "self-change");
    await expectCode(revokeAdminUserSessions(actor, "system-1"), "self-change");
    await expectCode(resetAdminUserMfa(actor, "system-1", "perdeu o celular"), "self-change");
  });

  it("only manages Admin accounts", async () => {
    mocks.txFindFirst.mockResolvedValue(null);
    await expectCode(assignAdminRole(actor, "customer-1", "SELLER_ADMIN"), "not-found");
    expect(mocks.txFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "customer-1", role: { in: ["ADMIN", "SYSTEM_ADMIN", "SELLER_ADMIN"] } },
    }));
  });

  it("revokes sessions by bumping the session version, with an audit entry", async () => {
    target("SELLER_ADMIN");
    await revokeAdminUserSessions(actor, "target-1");
    expect(mocks.txUpdate).toHaveBeenCalledWith({ where: { id: "target-1" }, data: { sessionVersion: { increment: 1 } } });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "admin_user.sessions_revoked" }));
  });

  it("requires a reason before resetting another Admin's MFA and records the actor", async () => {
    await expectCode(resetAdminUserMfa(actor, "target-1", "  curto "), "mfa-reason");
    mocks.findFirst.mockResolvedValue({ id: "target-1" });
    mocks.resetAdminMfa.mockResolvedValue({ revokedSessions: true });
    await resetAdminUserMfa(actor, "target-1", "  perdeu o celular  ");
    expect(mocks.resetAdminMfa).toHaveBeenCalledWith("target-1", "sistema", "perdeu o celular", "system-1");
  });

  it("creates accounts with a one-time temporary password, forced change and an audit entry", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.txCreate.mockResolvedValue({ id: "new-1", role: "SELLER_ADMIN" });
    const result = await createAdminUser(actor, { name: " Loja ", email: " Dono@Example.com ", role: "SELLER_ADMIN" });
    expect(result.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{20}$/);
    const data = mocks.txCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "Loja", email: "dono@example.com", role: "SELLER_ADMIN", active: true, mustChangePassword: true });
    expect(data.passwordHash).not.toContain(result.temporaryPassword);
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "admin_user.created", entityId: "new-1" }));
  });

  it("refuses a duplicate email", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing" });
    await expectCode(createAdminUser(actor, { name: "X", email: "x@example.com", role: "SELLER_ADMIN" }), "email-taken");
    expect(mocks.txCreate).not.toHaveBeenCalled();
  });

  it("masks emails for operator listings", () => {
    expect(maskEmail("proprietario@gmail.com")).toBe("p******@g****.com");
    expect(maskEmail("a@b.co")).toBe("*@*.co");
  });
});
