import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeOfferProduct } from "@/lib/product-offer.fixture";

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  indexable: true,
  checkoutEnabled: true,
}));

vi.mock("@/lib/storefront", () => ({ getProducts: mocks.getProducts }));
vi.mock("@/lib/storefront-commerce", () => ({ getStorefrontCommerceState: () => ({ checkoutEnabled: mocks.checkoutEnabled }) }));
vi.mock("@/lib/seo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo")>()),
  isPublicIndexingEnabled: () => mocks.indexable,
}));

const { GET } = await import("@/app/feeds/google-products.xml/route");

describe("GET /feeds/google-products.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.indexable = true;
    mocks.checkoutEnabled = true;
  });
  afterEach(() => vi.restoreAllMocks());

  it("serves the RSS feed, kept out of the index", async () => {
    mocks.getProducts.mockResolvedValueOnce([makeOfferProduct()]);
    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("<g:id>var_p</g:id>");
    expect(xml).toContain("<g:link>https://raredept.com.br/produto/camiseta-supreme?size=P</g:link>");
    expect(mocks.getProducts).toHaveBeenCalledWith();
  });

  it("is a real 404 outside the indexable production build (staging data never reaches Merchant Center)", async () => {
    mocks.indexable = false;
    const response = await GET();
    expect(response.status).toBe(404);
    expect(mocks.getProducts).not.toHaveBeenCalled();
  });

  it("answers 503 (never an empty 200 that would delist the catalog) when the catalog cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getProducts.mockRejectedValueOnce(new Error("DATABASE_URL=postgres://secret"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("postgres");
  });
});
