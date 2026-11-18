import { describe, expect, it } from "vitest";
import {
  buildGoogleMerchantFeedItems,
  getMerchantAvailability,
  renderGoogleMerchantFeedXml,
} from "@/lib/google-merchant-feed";
import { formatMoney } from "@/lib/money";
import { buildProductOfferSnapshot } from "@/lib/product-offer";
import { makeOfferProduct } from "@/lib/product-offer.fixture";
import { buildProductJsonLdFromSnapshot } from "@/lib/structured-data";

const siteUrl = "https://raredept.com.br";

describe("Google Merchant Center feed items", () => {
  it("exports one item per active size, grouped, with the catalog price and the real sale price", () => {
    const feed = buildGoogleMerchantFeedItems([buildProductOfferSnapshot(makeOfferProduct(), { siteUrl, checkoutEnabled: true })]);

    expect(feed.productsExported).toBe(1);
    expect(feed.exclusions).toEqual([]);
    expect(feed.items).toEqual([
      {
        id: "var_p",
        itemGroupId: "prod_camiseta_1",
        title: "Camiseta Supreme - Tamanho P",
        description: "Camiseta Supreme NBA YoungBoy, algodão.",
        link: "https://raredept.com.br/produto/camiseta-supreme?size=P",
        imageLink: "https://media.example/products/a-rare-v1-original.png",
        additionalImageLinks: ["https://media.example/products/b.webp"],
        availability: "in_stock",
        price: "311.58 BRL",
        salePrice: "280.42 BRL",
        brand: "Supreme",
        productType: "Camisetas",
        size: "P",
      },
      expect.objectContaining({ id: "var_m", availability: "out_of_stock", size: "M", link: "https://raredept.com.br/produto/camiseta-supreme?size=M" }),
    ]);
  });

  it("exports nothing it would have to invent (colour, gender, age group, GTIN, MPN, condition)", () => {
    const feed = buildGoogleMerchantFeedItems([buildProductOfferSnapshot(makeOfferProduct(), { siteUrl, checkoutEnabled: true })]);
    const xml = renderGoogleMerchantFeedXml(feed.items, { siteUrl });
    for (const attribute of ["g:color", "g:gender", "g:age_group", "g:gtin", "g:mpn", "g:condition", "g:google_product_category", "g:shipping", "g:installment", "g:sale_price_effective_date"]) {
      expect(xml, attribute).not.toContain(`<${attribute}>`);
    }
    // No stock quantities or internal data leave the store.
    expect(xml).not.toMatch(/reserved|quantity|<g:sku|SUP-M|<g:stock/i);
  });

  it("exports a single-size product without group or one-size label, at full price", () => {
    const feed = buildGoogleMerchantFeedItems([buildProductOfferSnapshot(
      makeOfferProduct({
        variants: [{ id: "var_u", size: "Único", sku: null, stock: 1, reservedStock: 0, active: true }],
        pricing: { basePriceInCents: 19990, finalPriceInCents: 19990, discountInCents: 0, percentOff: 0, promotion: null },
      }),
      { siteUrl, checkoutEnabled: true },
    )]);
    expect(feed.items[0]).toMatchObject({ itemGroupId: null, title: "Camiseta Supreme", size: null, price: "199.90 BRL", salePrice: null, link: "https://raredept.com.br/produto/camiseta-supreme" });
  });

  it("reports every size out_of_stock while online checkout is paused", () => {
    expect(getMerchantAvailability(true, false)).toBe("out_of_stock");
    expect(getMerchantAvailability(false, true)).toBe("out_of_stock");
    expect(getMerchantAvailability(true, true)).toBe("in_stock");
    const feed = buildGoogleMerchantFeedItems([buildProductOfferSnapshot(makeOfferProduct(), { siteUrl, checkoutEnabled: false })]);
    expect(feed.items.map((item) => item.availability)).toEqual(["out_of_stock", "out_of_stock"]);
  });

  it("excludes products Merchant Center would reject instead of sending bad data", () => {
    const feed = buildGoogleMerchantFeedItems([
      buildProductOfferSnapshot(makeOfferProduct({ id: "no_image", slug: "sem-imagem", images: [{ url: "https://media.example/v.mp4" }, { url: "/a.gif" }] }), { siteUrl, checkoutEnabled: true }),
      buildProductOfferSnapshot(makeOfferProduct({ id: "no_variant", slug: "sem-tamanho", variants: [] }), { siteUrl, checkoutEnabled: true }),
      buildProductOfferSnapshot(makeOfferProduct({ id: "zero", slug: "zero", pricing: { basePriceInCents: 0, finalPriceInCents: 0, discountInCents: 0, percentOff: 0, promotion: null } }), { siteUrl, checkoutEnabled: true }),
    ]);
    expect(feed.items).toEqual([]);
    expect(feed.productsExported).toBe(0);
    expect(feed.exclusions).toEqual([
      { productId: "no_image", slug: "sem-imagem", reason: "no-feed-image" },
      { productId: "no_variant", slug: "sem-tamanho", reason: "no-active-variant" },
      { productId: "zero", slug: "zero", reason: "invalid-price" },
    ]);
  });

  it("respects Merchant Center length limits", () => {
    const feed = buildGoogleMerchantFeedItems([buildProductOfferSnapshot(
      makeOfferProduct({ title: "T".repeat(400), description: "D".repeat(6000), brand: "B".repeat(100) }),
      { siteUrl, checkoutEnabled: true },
    )]);
    expect(feed.items[0]!.title.length).toBeLessThanOrEqual(150);
    expect(feed.items[0]!.description.length).toBeLessThanOrEqual(5000);
    expect(feed.items[0]!.brand!.length).toBeLessThanOrEqual(70);
  });
});

describe("Google Merchant Center feed XML", () => {
  it("renders RSS 2.0 with the g: namespace and escapes text safely", () => {
    const feed = buildGoogleMerchantFeedItems([buildProductOfferSnapshot(
      makeOfferProduct({ title: "Camiseta <Rare> & \"Co\"", description: "Linha 1\u0001 com 'aspas' & <b>tags</b>" }),
      { siteUrl, checkoutEnabled: true },
    )]);
    const xml = renderGoogleMerchantFeedXml(feed.items, { siteUrl });

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">')).toBe(true);
    expect(xml).toContain("<g:title>Camiseta &lt;Rare&gt; &amp; &quot;Co&quot; - Tamanho P</g:title>");
    expect(xml).toContain("<g:description>Linha 1 com &apos;aspas&apos; &amp; &lt;b&gt;tags&lt;/b&gt;</g:description>");
    expect(xml).not.toContain("\u0001");
    expect(xml).toContain("<g:price>311.58 BRL</g:price>");
    expect(xml).toContain("<g:sale_price>280.42 BRL</g:sale_price>");
    expect(xml).toContain("<g:item_group_id>prod_camiseta_1</g:item_group_id>");
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml.trimEnd().endsWith("</rss>")).toBe(true);
  });
});

/**
 * RARE-SEO-GOOGLE-01 §25 — Merchant × site consistency. For every size, the feed must not contradict
 * the product page: title, price, availability, brand, image and link come from one snapshot, and
 * the money values equal what PriceTag renders.
 */
describe("Merchant feed × storefront consistency", () => {
  const scenarios = [
    { name: "promotion, checkout on", product: makeOfferProduct(), checkoutEnabled: true },
    { name: "promotion, checkout paused", product: makeOfferProduct(), checkoutEnabled: false },
    {
      name: "full price, single size",
      product: makeOfferProduct({
        brand: null,
        variants: [{ id: "var_u", size: "Único", sku: "X", stock: 0, reservedStock: 0, active: true }],
        pricing: { basePriceInCents: 45000, finalPriceInCents: 45000, discountInCents: 0, percentOff: 0, promotion: null },
      }),
      checkoutEnabled: true,
    },
  ];

  it.each(scenarios)("feed, JSON-LD and page agree ($name)", ({ product, checkoutEnabled }) => {
    const snapshot = buildProductOfferSnapshot(product, { siteUrl, checkoutEnabled });
    const jsonLd = buildProductJsonLdFromSnapshot(snapshot);
    const feed = buildGoogleMerchantFeedItems([snapshot]);
    type SchemaOffer = { price: number; url: string; availability?: string; priceSpecification?: { price: number } };
    type SchemaProduct = { name: string; image?: string[]; offers: SchemaOffer };
    const schemaProducts = (jsonLd["@type"] === "ProductGroup" ? jsonLd.hasVariant : [jsonLd]) as unknown as SchemaProduct[];

    expect(feed.items).toHaveLength(schemaProducts.length);
    feed.items.forEach((item, index) => {
      const schemaProduct = schemaProducts[index]!;
      const offer = schemaProduct.offers;
      // Title: the storefront product title (plus the size when there are several).
      expect(item.title.startsWith(product.title)).toBe(true);
      expect(item.title).toBe(schemaProduct.name);
      // Price: the price the shopper pays now equals the JSON-LD Offer price and the page price.
      const paidPrice = item.salePrice ?? item.price;
      expect(paidPrice).toBe(`${offer.price.toFixed(2)} BRL`);
      expect(formatMoney(Math.round(Number.parseFloat(paidPrice) * 100))).toBe(formatMoney(product.pricing.finalPriceInCents));
      if (item.salePrice) {
        expect(item.price).toBe(`${offer.priceSpecification!.price.toFixed(2)} BRL`);
        expect(Math.round(Number.parseFloat(item.price) * 100)).toBe(product.pricing.basePriceInCents);
      } else {
        expect(offer.priceSpecification).toBeUndefined();
      }
      // Availability: never in_stock where the page cannot sell; same verdict as the JSON-LD.
      if (offer.availability === "https://schema.org/InStock") expect(item.availability).toBe("in_stock");
      if (offer.availability === "https://schema.org/OutOfStock") expect(item.availability).toBe("out_of_stock");
      if (offer.availability === undefined) expect(item.availability).toBe("out_of_stock");
      // Brand: the product brand, or absent on both sides.
      expect(item.brand).toBe(product.brand ?? null);
      expect((jsonLd.brand as { name?: string } | undefined)?.name ?? null).toBe(product.brand ?? null);
      // Image: the feed image is one the page/JSON-LD publishes.
      const schemaImages = (schemaProduct.image ?? (jsonLd.image as string[]));
      expect(schemaImages).toContain(item.imageLink);
      // Link: the same landing URL as the JSON-LD Offer, on the canonical host.
      expect(item.link).toBe(offer.url);
      expect(item.link.startsWith(`${siteUrl}/produto/${product.slug}`)).toBe(true);
    });
  });
});
