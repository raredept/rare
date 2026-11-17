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

// The approved table as typed in the Admin.
const valid = {
  cardInstallmentsEnabled: true, cardInstallmentsMax: "12", cardInstallmentsMin: "R$ 10,00",
  rate4x: "9", rate5x: "10", rate6x: "11", rate7x: "13", rate8x: "14", rate9x: "15", rate10x: "16", rate11x: "17", rate12x: "18",
};
const approvedBps = { 4: 900, 5: 1000, 6: 1100, 7: 1300, 8: 1400, 9: 1500, 10: 1600, 11: 1700, 12: 1800 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin_1", username: "ops", email: "ops@example.com", role: "SYSTEM_ADMIN" });
  mocks.prisma.$transaction.mockImplementation(async (work: (tx: typeof mocks.tx) => unknown) => work(mocks.tx));
  mocks.tx.storeSettings.findUnique.mockResolvedValue({ cardInstallmentsEnabled: false, cardInstallmentsMax: 12, cardInstallmentsMinInCents: 1000, cardInstallmentSurchargesBps: approvedBps });
});

describe("installment settings validation (1x-12x)", () => {
  it("accepts the approved table and stores it in basis points", () => {
    expect(parseCardInstallmentSettings(form(valid))).toEqual({
      ok: true,
      value: { cardInstallmentsEnabled: true, cardInstallmentsMax: 12, cardInstallmentsMinInCents: 1000, cardInstallmentSurchargesBps: Object.fromEntries(Object.entries(approvedBps)) },
    });
  });

  it("ignores any 1x-3x surcharge field: interest-free is fixed", () => {
    const parsed = parseCardInstallmentSettings(form({ ...valid, rate1x: "5", rate2x: "5", rate3x: "5" }));
    expect(parsed.ok && Object.keys(parsed.value.cardInstallmentSurchargesBps)).toEqual(["4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  });

  it.each([
    [{ cardInstallmentsMax: "13" }, "max"],
    [{ cardInstallmentsMax: "0" }, "max"],
    [{ cardInstallmentsMax: "abc" }, "max"],
    [{ cardInstallmentsMin: "R$ 4,99" }, "min"],
    [{ cardInstallmentsMin: "R$ 9,99" }, "min"],
    [{ cardInstallmentsMin: "" }, "min"],
    [{ rate4x: "-1" }, "range-4"],
    [{ rate12x: "31" }, "range-12"],
    [{ rate7x: "abc" }, "range-7"],
    [{ rate11x: "" }, "missing-11"],
  ])("rejects %o (%s)", (override, code) => {
    expect(parseCardInstallmentSettings(form({ ...valid, ...override }))).toEqual({ ok: false, code });
    expect(cardInstallmentSettingsErrorMessage(code)).toBeTruthy();
  });

  it("allows a lower maximum without the higher rates (kept, not offered)", () => {
    expect(parseCardInstallmentSettings(form({ ...valid, cardInstallmentsMax: "6", rate7x: "", rate8x: "", rate9x: "", rate10x: "", rate11x: "", rate12x: "" }))).toMatchObject({ ok: true, value: { cardInstallmentsMax: 6, cardInstallmentSurchargesBps: { 6: 1100, 7: null } } });
  });

  it("shows only fixed messages for codes from the URL", () => {
    expect(cardInstallmentSettingsErrorMessage("<script>")).toBeNull();
    expect(cardInstallmentSettingsErrorMessage("range-13")).toBeNull();
    expect(cardInstallmentSettingsErrorMessage("missing-3")).toBeNull();
    expect(cardInstallmentSettingsErrorMessage(undefined)).toBeNull();
  });
});

describe("saveCardInstallmentSettingsAction", () => {
  it("requires system.settings before anything else and audits before/after", async () => {
    const { saveCardInstallmentSettingsAction } = await import("@/app/admin/(protected)/settings/actions");
    await expect(saveCardInstallmentSettingsAction(form({ ...valid, rate12x: "20" }))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.requireAdmin).toHaveBeenCalledWith("system.settings");
    expect(mocks.tx.storeSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ cardInstallmentsEnabled: true, cardInstallmentSurchargesBps: expect.objectContaining({ 12: 2000 }) }) }));
    const audit = mocks.tx.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ actorUserId: "admin_1", actorLabel: "ops", action: "settings.installments_updated", entityType: "StoreSettings", entityId: "store" });
    expect(audit.before).toMatchObject({ enabled: false, maxInstallments: 12, surchargesBps: { "4x": 900, "12x": 1800 } });
    expect(audit.after).toMatchObject({ enabled: true, maxInstallments: 12, interestFreeInstallments: 3, minInstallmentInCents: 1000, surchargesBps: { "4x": 900, "11x": 1700, "12x": 2000 } });
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain("success=installments-saved");
  });

  it("saves nothing and writes no audit on invalid input", async () => {
    const { saveCardInstallmentSettingsAction } = await import("@/app/admin/(protected)/settings/actions");
    await expect(saveCardInstallmentSettingsAction(form({ ...valid, rate9x: "80" }))).rejects.toThrow("error=installments&code=range-9");
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
