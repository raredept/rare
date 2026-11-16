import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardInstallmentSettingsErrorMessage, parseCardInstallmentSettings } from "@/lib/card-installment-settings";

const mocks = vi.hoisted(() => {
  const tx = { storeSettings: { findUnique: vi.fn(), upsert: vi.fn() }, adminAuditLog: { create: vi.fn() } };
  return {
    tx,
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    prisma: { $transaction: vi.fn(), storeSettings: { upsert: vi.fn() } },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

function form(values: Record<string, string | boolean>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === true) data.set(key, "on");
    else if (value !== false) data.set(key, value);
  }
  return data;
}

const valid = { cardInstallmentsEnabled: true, cardInstallmentsMax: "6", cardInstallmentsMin: "R$ 10,00", rate4x: "6", rate5x: "7,5", rate6x: "9" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin_1", username: "ops", email: "ops@example.com", role: "SYSTEM_ADMIN" });
  mocks.prisma.$transaction.mockImplementation(async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
  mocks.tx.storeSettings.findUnique.mockResolvedValue({ cardInstallmentsEnabled: false, cardInstallmentsMax: 6, cardInstallmentsMinInCents: 1000, cardInstallment4xBps: 800, cardInstallment5xBps: null, cardInstallment6xBps: null });
});

describe("installment settings validation", () => {
  it("accepts the approved policy and stores rates in basis points", () => {
    expect(parseCardInstallmentSettings(form(valid))).toEqual({
      ok: true,
      value: { cardInstallmentsEnabled: true, cardInstallmentsMax: 6, cardInstallmentsMinInCents: 1000, cardInstallment4xBps: 600, cardInstallment5xBps: 750, cardInstallment6xBps: 900 },
    });
  });

  it.each([
    [{ cardInstallmentsMax: "7" }, "max"],
    [{ cardInstallmentsMax: "0" }, "max"],
    [{ cardInstallmentsMax: "abc" }, "max"],
    [{ cardInstallmentsMin: "R$ 4,99" }, "min"],
    [{ cardInstallmentsMin: "" }, "min"],
    [{ rate4x: "-1" }, "range-4"],
    [{ rate5x: "31" }, "range-5"],
    [{ rate6x: "abc" }, "range-6"],
    [{ rate5x: "" }, "missing-5"],
  ])("rejects %o (%s)", (override, code) => {
    expect(parseCardInstallmentSettings(form({ ...valid, ...override }))).toEqual({ ok: false, code });
    expect(cardInstallmentSettingsErrorMessage(code)).toBeTruthy();
  });

  it("allows a lower maximum without the higher rates (kept, not offered)", () => {
    expect(parseCardInstallmentSettings(form({ ...valid, cardInstallmentsMax: "3", rate4x: "", rate5x: "", rate6x: "" }))).toMatchObject({ ok: true, value: { cardInstallmentsMax: 3, cardInstallment4xBps: null } });
    expect(parseCardInstallmentSettings(form({ ...valid, cardInstallmentsMax: "4", rate5x: "", rate6x: "" }))).toMatchObject({ ok: true, value: { cardInstallmentsMax: 4, cardInstallment4xBps: 600 } });
  });

  it("shows only fixed messages for codes from the URL", () => {
    expect(cardInstallmentSettingsErrorMessage("<script>")).toBeNull();
    expect(cardInstallmentSettingsErrorMessage(undefined)).toBeNull();
  });
});

describe("saveCardInstallmentSettingsAction", () => {
  it("requires system.settings before anything else and audits before/after (no card-named keys dropped)", async () => {
    const { saveCardInstallmentSettingsAction } = await import("@/app/admin/(protected)/settings/actions");
    await expect(saveCardInstallmentSettingsAction(form(valid))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.requireAdmin).toHaveBeenCalledWith("system.settings");
    expect(mocks.tx.storeSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ cardInstallmentsEnabled: true, cardInstallment6xBps: 900 }) }));
    const audit = mocks.tx.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ actorUserId: "admin_1", actorLabel: "ops", action: "settings.installments_updated", entityType: "StoreSettings", entityId: "store" });
    expect(audit.before).toMatchObject({ enabled: false, surcharge4xBps: 800, surcharge6xBps: null });
    expect(audit.after).toMatchObject({ enabled: true, maxInstallments: 6, interestFreeInstallments: 3, minInstallmentInCents: 1000, surcharge4xBps: 600, surcharge5xBps: 750, surcharge6xBps: 900 });
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain("success=installments-saved");
  });

  it("saves nothing and writes no audit on invalid input", async () => {
    const { saveCardInstallmentSettingsAction } = await import("@/app/admin/(protected)/settings/actions");
    await expect(saveCardInstallmentSettingsAction(form({ ...valid, rate6x: "80" }))).rejects.toThrow("error=installments&code=range-6");
    expect(mocks.tx.storeSettings.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("stops when the Admin lacks the permission (requireAdmin redirects)", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/admin/sem-acesso"));
    const { saveCardInstallmentSettingsAction } = await import("@/app/admin/(protected)/settings/actions");
    await expect(saveCardInstallmentSettingsAction(form(valid))).rejects.toThrow("/admin/sem-acesso");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
