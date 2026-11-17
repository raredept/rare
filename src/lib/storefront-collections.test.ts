import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromotionRule } from "@/lib/promotions/engine";

// RARE-COLLECTIONS-CART-01: the collection queries. Prisma is mocked; the promotion ENGINE is real,
// so "which promotion wins a product" is the production rule, not a copy.

const mocks = vi.hoisted(() => ({
  rules: [] as PromotionRule[],
  prisma: {
    $transaction: vi.fn(),
    productVariant: { fields: { reservedStock: "reservedStock-field" } },
    promotion: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/promotions/store", () => ({ loadApplicablePromotionRules: async () => mocks.rules }));

const CAMISETAS = "cat_camisetas";
const JAQUETAS = "cat_jaquetas";

function rule(overrides: Partial<PromotionRule> & { id: string }): PromotionRule {
  return {
    name: overrides.id, slug: overrides.id, status: "ACTIVE", type: "PERCENTAGE", value: 30, scope: "SELECTED_PRODUCTS",
    startsAt: null, endsAt: null, priority: 0, createdAt: new Date("2026-11-01T00:00:00.000Z"), badgeText: null,
    productIds: new Set(), categoryIds: new Set(), ...overrides,
  };
}

function row(id: string, categoryId: string | null, overrides: Record<string, unknown> = {}) {
  return {
    id, title: id, slug: id, priceInCents: 10_000, categoryId, subcategoryId: null, brand: "Corteiz", active: true, featured: false,
    createdAt: new Date("2026-11-01T00:00:00.000Z"), category: categoryId ? { id: categoryId, slug: categoryId.replace("cat_", "") } : null, subcategory: null,
    images: [], variants: [{ id: `${id}_v`, size: "G", active: true, stock: 3, reservedStock: 0 }], ...overrides,
  };
}

function promotion(overrides: Record<string, unknown> = {}) {
  return {
    id: "promo_sale_black", name: "Black Friday 30%", slug: "sale-black", status: "ACTIVE", value: 30, startsAt: null, endsAt: null,
    scope: "SELECTED_PRODUCTS", headline: "Black Friday", subheadline: "Até 30% off", badgeText: "SALE",
    storefrontCollectionEnabled: true, storefrontCollectionLabel: "SALE BLACK", storefrontCollectionSortOrder: 10,
    products: [{ productId: "camiseta_corteiz" }, { productId: "jaqueta" }], categories: [], ...overrides,
  };
}

describe("storefront collections", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rules = [];
    mocks.prisma.$transaction.mockImplementation((callback: (client: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma));
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.product.count.mockResolvedValue(0);
  });

  it("SELECTED_PRODUCTS: the camiseta is in the collection and keeps its category (Camisetas)", async () => {
    const camiseta = row("camiseta_corteiz", CAMISETAS);
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion());
    mocks.prisma.product.findMany.mockResolvedValueOnce([camiseta]).mockResolvedValueOnce([]);
    mocks.rules = [rule({ id: "promo_sale_black", productIds: new Set(["camiseta_corteiz", "jaqueta"]) })];

    const { getPublicCollection } = await import("@/lib/storefront");
    const collection = await getPublicCollection("sale-black");

    expect(collection?.label).toBe("SALE BLACK");
    expect(collection?.description).toBe("Até 30% off");
    expect(collection?.products.map((product) => product.id)).toEqual(["camiseta_corteiz"]);
    expect(collection?.products[0].categoryId).toBe(CAMISETAS);
    expect(collection?.products[0].pricing.finalPriceInCents).toBe(7_000);
    // Only reads: no product row is ever written by a collection.
    expect(mocks.prisma.product.update).not.toHaveBeenCalled();
    expect(mocks.prisma.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining({ AND: expect.arrayContaining([{ id: { in: ["camiseta_corteiz", "jaqueta"] } }]) })]) }),
    }));
  });

  it("competing promotions: a product another promotion wins is NOT shown in this collection", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion());
    mocks.prisma.product.findMany.mockResolvedValueOnce([row("camiseta_corteiz", CAMISETAS), row("jaqueta", JAQUETAS)]).mockResolvedValueOnce([]);
    mocks.rules = [
      rule({ id: "promo_sale_black", productIds: new Set(["camiseta_corteiz", "jaqueta"]) }),
      rule({ id: "promo_jaqueta_vip", value: 10, priority: 5, productIds: new Set(["jaqueta"]) }),
    ];
    const { getPublicCollection } = await import("@/lib/storefront");
    const collection = await getPublicCollection("sale-black");
    expect(collection?.products.map((product) => product.id)).toEqual(["camiseta_corteiz"]);
  });

  it("sold-out products stay, after the available ones", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion({ scope: "ALL_PRODUCTS", products: [] }));
    const soldOut = row("esgotada", CAMISETAS, { variants: [{ id: "v", size: "G", active: true, stock: 0, reservedStock: 0 }] });
    mocks.prisma.product.findMany.mockResolvedValueOnce([row("disponivel", CAMISETAS)]).mockResolvedValueOnce([soldOut]);
    mocks.rules = [rule({ id: "promo_sale_black", scope: "ALL_PRODUCTS" })];
    const { getPublicCollection } = await import("@/lib/storefront");
    expect((await getPublicCollection("sale-black"))?.products.map((product) => product.id)).toEqual(["disponivel", "esgotada"]);
  });

  it("SELECTED_CATEGORIES reads category OR subcategory, like the engine; ALL_PRODUCTS reads the whole active catalog", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion({ scope: "SELECTED_CATEGORIES", products: [], categories: [{ categoryId: CAMISETAS }] }));
    mocks.prisma.product.findMany.mockResolvedValueOnce([row("camiseta_corteiz", CAMISETAS)]).mockResolvedValueOnce([]);
    mocks.rules = [rule({ id: "promo_sale_black", scope: "SELECTED_CATEGORIES", categoryIds: new Set([CAMISETAS]) })];
    const { getPublicCollection } = await import("@/lib/storefront");
    expect((await getPublicCollection("sale-black"))?.products).toHaveLength(1);
    const target = { OR: [{ categoryId: { in: [CAMISETAS] } }, { subcategoryId: { in: [CAMISETAS] } }] };
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining({ AND: expect.arrayContaining([target]) })]) }),
    }));
  });

  it.each([
    ["PAUSED", { status: "PAUSED" }],
    ["ENDED", { status: "ENDED" }],
    ["DRAFT", { status: "DRAFT" }],
    ["SCHEDULED before its start", { status: "SCHEDULED", startsAt: new Date(Date.now() + 86_400_000) }],
    ["past its end", { endsAt: new Date(Date.now() - 1_000) }],
    ["collection switched off", { storefrontCollectionEnabled: false }],
    ["no discount value", { value: null }],
  ])("not public (404) when %s — and no product is read", async (_label, overrides) => {
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion(overrides));
    const { getPublicCollection } = await import("@/lib/storefront");
    expect(await getPublicCollection("sale-black")).toBeNull();
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("EMPTY: active but winning no product -> not public", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion());
    mocks.prisma.product.findMany.mockResolvedValueOnce([row("camiseta_corteiz", CAMISETAS)]).mockResolvedValueOnce([]);
    mocks.rules = [rule({ id: "outra", priority: 9, productIds: new Set(["camiseta_corteiz"]) }), rule({ id: "promo_sale_black", productIds: new Set(["camiseta_corteiz"]) })];
    const { getPublicCollection } = await import("@/lib/storefront");
    expect(await getPublicCollection("sale-black")).toBeNull();
  });

  it("unsafe slugs never reach the database", async () => {
    const { getPublicCollection } = await import("@/lib/storefront");
    expect(await getPublicCollection("../admin")).toBeNull();
    expect(mocks.prisma.promotion.findUnique).not.toHaveBeenCalled();
  });

  it("collection page: filters, sort and pagination reuse the catalog rules; 'Em promoção' is implied", async () => {
    const products = Array.from({ length: 30 }, (_, index) => row(`p${String(index).padStart(2, "0")}`, CAMISETAS, { priceInCents: 5_000 + index * 1_000, brand: index % 2 ? "Corteiz" : "BAPE" }));
    mocks.prisma.promotion.findUnique.mockResolvedValue(promotion({ scope: "ALL_PRODUCTS", products: [] }));
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.product.findMany.mockResolvedValueOnce(products).mockResolvedValueOnce([]);
    mocks.rules = [rule({ id: "promo_sale_black", scope: "ALL_PRODUCTS" })];
    const { getCollectionPageData } = await import("@/lib/storefront");
    const page2 = await getCollectionPageData("sale-black", { page: 2 }, { available: false, promo: true, sort: "price-desc" });
    expect(page2?.total).toBe(30);
    expect(page2?.products).toHaveLength(6);
    expect(page2?.hasMore).toBe(false);
    expect(page2?.refinements.promo).toBe(false);
    expect(page2?.facets.promoCount).toBe(0);
    const prices = page2!.products.map((product) => product.pricing.finalPriceInCents);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);

    mocks.prisma.product.findMany.mockResolvedValueOnce(products).mockResolvedValueOnce([]);
    const corteiz = await getCollectionPageData("sale-black", { brand: "corteiz", page: 1 }, { available: false, promo: false, sort: "relevance" });
    expect(corteiz?.total).toBe(15);
  });

  describe("menu", () => {
    it("only live collections that win a product, ordered; two queries whatever the number of collections", async () => {
      const live = (id: string, slug: string, label: string, sortOrder: number) => ({
        id, name: id, slug, status: "ACTIVE", value: 20, startsAt: null, endsAt: null, storefrontCollectionEnabled: true, storefrontCollectionLabel: label, storefrontCollectionSortOrder: sortOrder,
      });
      mocks.prisma.promotion.findMany.mockResolvedValue([
        live("promo_drop", "drop", "Drop especial", 20),
        live("promo_sale_black", "sale-black", "SALE BLACK", 10),
        live("promo_vazia", "vazia", "Vazia", 0),
        { ...live("promo_futura", "futura", "Futura", 0), status: "SCHEDULED", startsAt: new Date(Date.now() + 86_400_000) },
      ]);
      mocks.prisma.product.findMany.mockResolvedValue([
        { id: "camiseta_corteiz", priceInCents: 10_000, categoryId: CAMISETAS, subcategoryId: null },
        { id: "jaqueta", priceInCents: 50_000, categoryId: JAQUETAS, subcategoryId: null },
      ]);
      mocks.rules = [
        rule({ id: "promo_sale_black", productIds: new Set(["camiseta_corteiz"]) }),
        rule({ id: "promo_drop", productIds: new Set(["jaqueta"]) }),
        rule({ id: "promo_vazia", productIds: new Set() }),
      ];
      const { getNavigationCollections } = await import("@/lib/storefront");
      const menu = await getNavigationCollections();
      expect(menu.map((item) => [item.label, item.href])).toEqual([["SALE BLACK", "/colecao/sale-black"], ["Drop especial", "/colecao/drop"]]);
      expect(mocks.prisma.promotion.findMany).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(mocks.prisma.promotion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ storefrontCollectionEnabled: true }) }));
    });

    it("no live collection: no product query at all", async () => {
      mocks.prisma.promotion.findMany.mockResolvedValue([]);
      const { getNavigationCollections } = await import("@/lib/storefront");
      expect(await getNavigationCollections()).toEqual([]);
      expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
    });
  });

  it("homepage campaign keeps its behavior: winning products only, first `limit`", async () => {
    mocks.prisma.promotion.findUnique.mockResolvedValue({ scope: "SELECTED_PRODUCTS", products: [{ productId: "a" }, { productId: "b" }, { productId: "c" }], categories: [] });
    mocks.prisma.product.findMany.mockResolvedValueOnce([row("a", CAMISETAS), row("b", CAMISETAS), row("c", CAMISETAS)]).mockResolvedValueOnce([]);
    mocks.rules = [rule({ id: "campaign", productIds: new Set(["a", "b", "c"]) }), rule({ id: "other", priority: 3, productIds: new Set(["b"]) })];
    const { getCampaignProducts } = await import("@/lib/storefront");
    expect((await getCampaignProducts("campaign", 4)).map((product) => product.id)).toEqual(["a", "c"]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([row("a", CAMISETAS), row("b", CAMISETAS), row("c", CAMISETAS)]).mockResolvedValueOnce([]);
    expect(await getCampaignProducts("campaign", 1)).toHaveLength(1);
  });
});
