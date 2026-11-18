import { describe, expect, it } from "vitest";
import {
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebsiteJsonLd,
  stringifyJsonLd,
} from "@/lib/structured-data";
import { productOfferContractIssue } from "@/lib/product-offer-contract";

const appUrl = "https://raredept.com.br";

describe("storefront structured data", () => {
  it("publishes only real organization and website search data", () => {
    expect(buildOrganizationJsonLd(appUrl)).toMatchObject({
      "@type": "Organization",
      name: "RARE",
      alternateName: ["RARE Dept", "raredept"],
      url: appUrl,
      sameAs: ["https://www.instagram.com/rare.deptt/"],
    });
    expect(buildWebsiteJsonLd(appUrl)).toMatchObject({
      "@type": "WebSite",
      name: "RARE",
      alternateName: ["RARE Dept", "raredept"],
      url: appUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: "https://raredept.com.br/?q={search_term_string}",
      },
    });
  });

  it("keeps the displayed price but claims no availability while checkout is paused", () => {
    const data = buildProductJsonLd({
      name: "Camiseta RARE",
      description: "Camiseta importada.",
      imageUrls: ["https://raredept.com.br/uploads/camiseta.webp"],
      priceInCents: 19990,
      inStock: true,
      url: "https://raredept.com.br/produto/camiseta-rare",
      brand: "RARE",
      sku: "RARE-001",
      checkoutEnabled: false,
    });

    expect(data).toMatchObject({ "@type": "Product", brand: { "@type": "Brand", name: "RARE" }, sku: "RARE-001" });
    expect(JSON.parse(stringifyJsonLd(data)).offers).toEqual({
      "@type": "Offer",
      priceCurrency: "BRL",
      price: 199.9,
      url: "https://raredept.com.br/produto/camiseta-rare",
    });
  });

  it("reports sold-out items as OutOfStock even while checkout is paused", () => {
    const data = buildProductJsonLd({
      name: "Camiseta RARE",
      imageUrls: [],
      priceInCents: 19990,
      inStock: false,
      url: "https://raredept.com.br/produto/camiseta-rare",
      checkoutEnabled: false,
    });

    expect(data.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
  });

  it("adds an accurate Offer when checkout is enabled", () => {
    const data = buildProductJsonLd({
      name: "Camiseta RARE",
      imageUrls: [],
      priceInCents: 19990,
      inStock: false,
      url: "https://raredept.com.br/produto/camiseta-rare",
      checkoutEnabled: true,
    });

    expect(data.offers).toEqual({
      "@type": "Offer",
      priceCurrency: "BRL",
      price: 199.9,
      availability: "https://schema.org/OutOfStock",
      url: "https://raredept.com.br/produto/camiseta-rare",
    });
  });

  it("claims InStock only for an available item while checkout is enabled", () => {
    const data = buildProductJsonLd({
      name: "Camiseta RARE",
      imageUrls: [],
      priceInCents: 19990,
      inStock: true,
      url: "https://raredept.com.br/produto/camiseta-rare",
      checkoutEnabled: true,
    });

    expect(data.offers).toMatchObject({ availability: "https://schema.org/InStock" });
    expect(productOfferContractIssue(data.offers, true)).toBeNull();
  });

  describe("offer contract used by the release smoke", () => {
    const build = (inStock: boolean, checkoutEnabled: boolean) =>
      buildProductJsonLd({ name: "Peça", imageUrls: [], priceInCents: 90000, inStock, url: "https://raredept.com.br/produto/peca", checkoutEnabled }).offers;

    it("accepts what the storefront publishes in every state", () => {
      // Paused + available: Offer with price, no availability. Paused/enabled + sold (a UNIQUE piece
      // after its sale): OutOfStock. Enabled + available: InStock.
      expect(productOfferContractIssue(build(true, false), false)).toBeNull();
      expect(build(false, false)).toMatchObject({ availability: "https://schema.org/OutOfStock" });
      expect(productOfferContractIssue(build(false, false), false)).toBeNull();
      expect(productOfferContractIssue(build(false, true), true)).toBeNull();
      expect(productOfferContractIssue(build(true, true), true)).toBeNull();
      expect(productOfferContractIssue(undefined, false)).toBeNull();
    });

    it("fails an InStock claim while checkout is paused, in any spelling", () => {
      for (const availability of ["https://schema.org/InStock", "http://schema.org/InStock", "InStock"]) {
        expect(productOfferContractIssue({ "@type": "Offer", availability }, false)).toBe("InStock declared while checkout is paused");
      }
      expect(productOfferContractIssue(build(true, true), false)).toBe("InStock declared while checkout is paused");
    });

    it("fails malformed or unexpected offers", () => {
      expect(productOfferContractIssue([{ "@type": "Offer" }], false)).not.toBeNull();
      expect(productOfferContractIssue({ "@type": "AggregateOffer" }, false)).not.toBeNull();
      expect(productOfferContractIssue({ "@type": "Offer", availability: "https://schema.org/PreOrder" }, true)).not.toBeNull();
    });
  });

  it("escapes markup-breaking characters in JSON-LD", () => {
    expect(stringifyJsonLd({ name: "</script>" })).not.toContain("</script>");
  });
});
