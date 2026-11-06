import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    promotion: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    promotionProduct: { deleteMany: vi.fn() },
    promotionCategory: { deleteMany: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  };
  return {
    tx,
    redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
    requireAdmin: vi.fn(),
    prisma: {
      promotion: { findUnique: vi.fn() },
      product: { count: vi.fn() },
      category: { count: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

const admin = { id: "admin_1", email: "admin@rare.test", username: "ops" };

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
}

const draftForm = { name: "SALE BLACK FRIDAY", type: "PERCENTAGE", value: "25", scope: "SELECTED_PRODUCTS", productIds: ["prod_1"] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(admin);
  mocks.prisma.product.count.mockResolvedValue(1);
  mocks.prisma.category.count.mockResolvedValue(0);
  mocks.tx.promotion.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "promo_new", createdAt: new Date(), updatedAt: new Date(), ...data }));
});

describe("promotion admin actions", () => {
  it("requires an authorized Admin before reading anything (direct Server Action call)", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/admin/login"));
    const { savePromotionAction, changePromotionStatusAction, duplicatePromotionAction } = await import("@/app/admin/(protected)/promotions/actions");
    await expect(savePromotionAction({}, form(draftForm))).rejects.toThrow("/admin/login");
    mocks.requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/admin/login"));
    await expect(changePromotionStatusAction(form({ promotionId: "promo_1", intent: "activate" }))).rejects.toThrow("/admin/login");
    mocks.requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/admin/login"));
    await expect(duplicatePromotionAction(form({ promotionId: "promo_1" }))).rejects.toThrow("/admin/login");
    expect(mocks.prisma.promotion.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.promotion.create).not.toHaveBeenCalled();
  });

  it("creates every promotion as DRAFT, ignoring status and audit fields in the payload, and audits it", async () => {
    const { savePromotionAction } = await import("@/app/admin/(protected)/promotions/actions");
    await expect(savePromotionAction({}, form({ ...draftForm, status: "ACTIVE", createdById: "attacker", updatedById: "attacker", id: "forced" })))
      .rejects.toThrow("NEXT_REDIRECT:/admin/promotions/promo_new?success=promotion-created");
    const data = mocks.tx.promotion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "DRAFT", createdById: "admin_1", updatedById: "admin_1", value: 25 });
    expect(data).not.toHaveProperty("id");
    expect(mocks.tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ action: "promotion.created", actorUserId: "admin_1", entityId: "promo_new" });
  });

  it("refuses targets that do not exist", async () => {
    mocks.prisma.product.count.mockResolvedValueOnce(0);
    const { savePromotionAction } = await import("@/app/admin/(protected)/promotions/actions");
    await expect(savePromotionAction({}, form(draftForm))).resolves.toEqual({ errors: ["Há produto inexistente na seleção."] });
    expect(mocks.tx.promotion.create).not.toHaveBeenCalled();
  });

  it("requires a complete promotion when editing one that is live", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValueOnce({ id: "promo_1", status: "ACTIVE", startsAt: null, endsAt: null, products: [], categories: [] });
    const { savePromotionAction } = await import("@/app/admin/(protected)/promotions/actions");
    const result = await savePromotionAction({}, form({ promotionId: "promo_1", name: "X", type: "PERCENTAGE", scope: "SELECTED_PRODUCTS" }));
    expect(result.errors).toEqual(expect.arrayContaining(["Informe o valor do desconto.", "Selecione ao menos um produto."]));
  });

  it("audits discount changes with before and after", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValueOnce({
      id: "promo_1", name: "BF", slug: "bf", status: "ACTIVE", type: "PERCENTAGE", value: 20, scope: "SELECTED_PRODUCTS", startsAt: null, endsAt: null,
      priority: 0, homepageFeatured: false, products: [{ productId: "prod_1" }], categories: [],
    });
    mocks.tx.promotion.update.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({ id: "promo_1", status: "ACTIVE", ...data }));
    const { savePromotionAction } = await import("@/app/admin/(protected)/promotions/actions");
    await expect(savePromotionAction({}, form({ ...draftForm, promotionId: "promo_1", name: "BF", slug: "bf", value: "30" }))).rejects.toThrow("success=promotion-saved");
    const audit = mocks.tx.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: "promotion.updated", before: expect.objectContaining({ value: 20 }), after: expect.objectContaining({ value: 30 }) });
  });

  it("schedules (not activates) a promotion whose start is in the future", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValueOnce({
      id: "promo_1", status: "DRAFT", value: 25, type: "PERCENTAGE", scope: "SELECTED_PRODUCTS", startsAt: new Date(Date.now() + 86_400_000), endsAt: null,
      homepageFeatured: false, headline: null, _count: { products: 1, categories: 0 },
    });
    mocks.tx.promotion.updateMany.mockResolvedValueOnce({ count: 1 });
    const { changePromotionStatusAction } = await import("@/app/admin/(protected)/promotions/actions");
    await expect(changePromotionStatusAction(form({ promotionId: "promo_1", intent: "activate" }))).rejects.toThrow("success=promotion-activate");
    expect(mocks.tx.promotion.updateMany).toHaveBeenCalledWith({ where: { id: "promo_1", status: "DRAFT" }, data: { status: "SCHEDULED", updatedById: "admin_1" } });
    expect(mocks.tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ action: "promotion.activated" });
  });

  it("refuses to activate an incomplete promotion (no discount invented)", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValueOnce({
      id: "promo_1", status: "DRAFT", value: null, type: "PERCENTAGE", scope: "SELECTED_PRODUCTS", startsAt: null, endsAt: null,
      homepageFeatured: true, headline: "SALE BLACK FRIDAY", _count: { products: 0, categories: 0 },
    });
    const { changePromotionStatusAction } = await import("@/app/admin/(protected)/promotions/actions");
    await expect(changePromotionStatusAction(form({ promotionId: "promo_1", intent: "activate" }))).rejects.toThrow("error=promotion-incomplete");
    expect(mocks.tx.promotion.updateMany).not.toHaveBeenCalled();
  });

  it("refuses impossible transitions and unknown intents", async () => {
    const { changePromotionStatusAction } = await import("@/app/admin/(protected)/promotions/actions");
    mocks.prisma.promotion.findUnique.mockResolvedValueOnce({ id: "promo_1", status: "ENDED", _count: { products: 1, categories: 0 } });
    await expect(changePromotionStatusAction(form({ promotionId: "promo_1", intent: "activate" }))).rejects.toThrow("error=promotion-invalid-transition");
    await expect(changePromotionStatusAction(form({ promotionId: "promo_1", intent: "delete" }))).rejects.toThrow("error=promotion-action-failed");
    await expect(changePromotionStatusAction(form({ promotionId: "../../x", intent: "pause" }))).rejects.toThrow("error=promotion-action-failed");
  });
});
