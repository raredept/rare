import { describe, expect, it } from "vitest";
import {
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildWebsiteJsonLd,
  stringifyJsonLd,
} from "@/lib/structured-data";

const appUrl = "https://raredept.com.br";

describe("storefront structured data", () => {
  it("publishes only real organization and website search data", () => {
    expect(buildOrganizationJsonLd(appUrl)).toMatchObject({
      "@type": "Organization",
      name: "RARE",
      url: appUrl,
      sameAs: ["https://www.instagram.com/raredept/"],
    });
    expect(buildWebsiteJsonLd(appUrl)).toMatchObject({
      "@type": "WebSite",
      url: appUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: "https://raredept.com.br/?q={search_term_string}",
      },
    });
  });

  it("omits Offer while checkout is paused", () => {
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
    expect(data.offers).toBeUndefined();
  });

  it("adds an accurate Offer only when checkout is enabled", () => {
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
      price: "199.90",
      availability: "https://schema.org/OutOfStock",
      url: "https://raredept.com.br/produto/camiseta-rare",
    });
  });

  it("escapes markup-breaking characters in JSON-LD", () => {
    expect(stringifyJsonLd({ name: "</script>" })).not.toContain("</script>");
  });
});
