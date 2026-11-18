import { describe, expect, it } from "vitest";
import {
  buildProductOfferSnapshot,
  getLastValidDay,
  getProductCategoryPath,
  isPromotionalCategorySlug,
} from "@/lib/product-offer";
import { makeOfferProduct } from "@/lib/product-offer.fixture";
import { collectProductPageOffers, productOfferContractIssue } from "@/lib/product-offer-contract";
import { buildProductJsonLdFromSnapshot } from "@/lib/structured-data";

const siteUrl = "https://raredept.com.br";

describe("product offer snapshot", () => {
  it("describes exactly what the page shows: final price, real strikethrough, per-size availability", () => {
    const snapshot = buildProductOfferSnapshot(makeOfferProduct(), { siteUrl, checkoutEnabled: true });

    expect(snapshot).toMatchObject({
      name: "Camiseta Supreme",
      url: "https://raredept.com.br/produto/camiseta-supreme",
      brand: "Supreme",
      categoryPath: ["Camisetas"],
      priceInCents: 28042,
      basePriceInCents: 31158,
      onSale: true,
      saleLastDay: null,
      inStock: true,
      isVariantGroup: true,
    });
    // Inactive sizes are not offered; M is fully reserved, so it cannot be bought now.
    expect(snapshot.variants).toEqual([
      { id: "var_p", size: "P", sku: null, inStock: true, url: "https://raredept.com.br/produto/camiseta-supreme?size=P" },
      { id: "var_m", size: "M", sku: "SUP-M", inStock: false, url: "https://raredept.com.br/produto/camiseta-supreme?size=M" },
    ]);
    expect(snapshot.imageUrls).toEqual([
      "https://media.example/products/a-rare-v1-original.png",
      "https://media.example/products/b.webp",
      "https://raredept.com.br/uploads/d.gif",
    ]);
    expect(snapshot.feedImageUrls).toEqual(["https://media.example/products/a-rare-v1-original.png", "https://media.example/products/b.webp"]);
  });

  it("keeps every non-video medium in structured data but only Merchant-supported formats in the feed", () => {
    const snapshot = buildProductOfferSnapshot(
      makeOfferProduct({ images: [{ url: "/seed-products/bermuda.svg" }, { url: "https://cdn.example/photo-123?w=800" }, { url: "https://cdn.example/look.JPG" }] }),
      { siteUrl, checkoutEnabled: true },
    );
    expect(snapshot.imageUrls).toEqual(["https://raredept.com.br/seed-products/bermuda.svg", "https://cdn.example/photo-123?w=800", "https://cdn.example/look.JPG"]);
    expect(snapshot.feedImageUrls).toEqual(["https://cdn.example/look.JPG"]);
  });

  it("uses the catalog price and no sale data without a winning promotion", () => {
    const snapshot = buildProductOfferSnapshot(
      makeOfferProduct({ pricing: { basePriceInCents: 19990, finalPriceInCents: 19990, discountInCents: 0, percentOff: 0, promotion: null } }),
      { siteUrl, checkoutEnabled: true },
    );
    expect(snapshot).toMatchObject({ priceInCents: 19990, basePriceInCents: 19990, onSale: false, saleLastDay: null });
  });

  it("only dates a promotional price when the promotion has a real end (last day in São Paulo)", () => {
    // Ends at 2026-11-30 00:00 in São Paulo (03:00 UTC): the price is valid through the 29th.
    expect(getLastValidDay(new Date("2026-11-30T03:00:00.000Z"))).toBe("2026-11-29");
    expect(getLastValidDay(new Date("2026-11-30T15:00:00.000Z"))).toBe("2026-11-30");
    expect(getLastValidDay(null)).toBeNull();
    const pricing = { ...makeOfferProduct().pricing, promotion: { ...makeOfferProduct().pricing.promotion!, endsAt: new Date("2026-11-30T03:00:00.000Z") } };
    expect(buildProductOfferSnapshot(makeOfferProduct({ pricing }), { siteUrl, checkoutEnabled: true }).saleLastDay).toBe("2026-11-29");
  });

  it("keeps a single-size product as a plain product with its own URL", () => {
    const snapshot = buildProductOfferSnapshot(
      makeOfferProduct({ variants: [{ id: "var_u", size: "Único", sku: "BAG-1", stock: 1, reservedStock: 0, active: true }] }),
      { siteUrl, checkoutEnabled: true },
    );
    expect(snapshot.isVariantGroup).toBe(false);
    expect(snapshot.variants).toEqual([{ id: "var_u", size: "Único", sku: "BAG-1", inStock: true, url: "https://raredept.com.br/produto/camiseta-supreme" }]);
  });

  it("uses only the real taxonomy for the category, never a promotional category", () => {
    expect(getProductCategoryPath({ category: { name: "Acessórios", slug: "acessorios" }, subcategory: { name: "Bags", slug: "bags" } })).toEqual(["Acessórios", "Bags"]);
    expect(getProductCategoryPath({ category: { name: "SALE", slug: "sale-black" }, subcategory: null })).toEqual([]);
    expect(getProductCategoryPath({ category: { name: "Camisetas", slug: "camisetas", active: false }, subcategory: null })).toEqual([]);
    for (const slug of ["sale-black", "black-friday", "promocao", "ofertas", "outlet"]) expect(isPromotionalCategorySlug(slug), slug).toBe(true);
    for (const slug of ["camisetas", "bags", "blusas", "calcas", "bones"]) expect(isPromotionalCategorySlug(slug), slug).toBe(false);
  });

  it("falls back to the short description, then the title, and drops empty brands", () => {
    const snapshot = buildProductOfferSnapshot(makeOfferProduct({ description: "  ", brand: " " }), { siteUrl, checkoutEnabled: true });
    expect(snapshot.description).toBe("Camiseta Supreme NBA YoungBoy");
    expect(snapshot.brand).toBeNull();
  });
});

describe("product JSON-LD from the snapshot", () => {
  it("publishes a ProductGroup varying by size, with one Offer per size", () => {
    const data = buildProductJsonLdFromSnapshot(buildProductOfferSnapshot(makeOfferProduct(), { siteUrl, checkoutEnabled: true }));
    expect(data).toMatchObject({
      "@type": "ProductGroup",
      name: "Camiseta Supreme",
      url: "https://raredept.com.br/produto/camiseta-supreme",
      brand: { "@type": "Brand", name: "Supreme" },
      category: "Camisetas",
      productGroupID: "prod_camiseta_1",
      variesBy: ["https://schema.org/size"],
    });
    const variants = data.hasVariant as Array<Record<string, unknown>>;
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      "@type": "Product",
      name: "Camiseta Supreme - Tamanho P",
      size: "P",
      offers: {
        "@type": "Offer",
        price: 280.42,
        priceCurrency: "BRL",
        priceSpecification: { "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice", price: 311.58, priceCurrency: "BRL" },
        availability: "https://schema.org/InStock",
        url: "https://raredept.com.br/produto/camiseta-supreme?size=P",
      },
    });
    expect(variants[1]).toMatchObject({ sku: "SUP-M", offers: { availability: "https://schema.org/OutOfStock" } });
    // No invented attributes and no priceValidUntil without a real end date.
    expect(JSON.stringify(data)).not.toMatch(/"(color|gtin\d*|mpn|itemCondition|priceValidUntil|suggestedGender|suggestedAge)"/);
  });

  it("never claims InStock while checkout is paused, for any size", () => {
    const data = buildProductJsonLdFromSnapshot(buildProductOfferSnapshot(makeOfferProduct(), { siteUrl, checkoutEnabled: false }));
    const offers = collectProductPageOffers([data]);
    expect(offers).toHaveLength(2);
    expect(offers.map((offer) => productOfferContractIssue(offer, false))).toEqual([null, null]);
    expect(JSON.stringify(data)).not.toContain("InStock");
  });

  it("adds priceValidUntil only for a promotion with a real end date", () => {
    const base = makeOfferProduct();
    const pricing = { ...base.pricing, promotion: { ...base.pricing.promotion!, endsAt: new Date("2026-11-30T03:00:00.000Z") } };
    const data = buildProductJsonLdFromSnapshot(buildProductOfferSnapshot({ ...base, pricing }, { siteUrl, checkoutEnabled: true }));
    expect((data.hasVariant as Array<{ offers: { priceValidUntil?: string } }>)[0]!.offers.priceValidUntil).toBe("2026-11-29");
  });

  it("keeps a plain Product (with sku and no strikethrough) for a single-size, full-price product", () => {
    const data = buildProductJsonLdFromSnapshot(buildProductOfferSnapshot(
      makeOfferProduct({
        variants: [{ id: "var_u", size: "Único", sku: "BAG-1", stock: 1, reservedStock: 0, active: true }],
        pricing: { basePriceInCents: 19990, finalPriceInCents: 19990, discountInCents: 0, percentOff: 0, promotion: null },
      }),
      { siteUrl, checkoutEnabled: true },
    ));
    expect(data).toMatchObject({ "@type": "Product", sku: "BAG-1", offers: { "@type": "Offer", price: 199.9, availability: "https://schema.org/InStock" } });
    expect((data.offers as Record<string, unknown>).priceSpecification).toBeUndefined();
    expect(collectProductPageOffers([data, { "@type": "BreadcrumbList" }])).toHaveLength(1);
  });
});
