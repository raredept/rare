import { describe, expect, it } from "vitest";
import { buildCatalogPageHref, CATALOG_PAGE_SIZE, normalizeCatalogPage } from "@/lib/catalog-pagination";

describe("catalog pagination URLs", () => {
  it("preserves exact search and brand meaning across next, previous and grouped category links", () => {
    const href = buildCatalogPageHref("camisetas", { query: " RARE + street ", brand: " STÜSSY & Nike ", page: 2 });
    const url = new URL(href, "https://rare.example");
    expect(url.pathname).toBe("/categoria/camisetas");
    expect(url.searchParams.get("q")).toBe("RARE + street");
    expect(url.searchParams.get("brand")).toBe("STÜSSY & Nike");
    expect(url.searchParams.get("page")).toBe("2");
    expect(buildCatalogPageHref("destaques", { query: "Rare", brand: "BAPE", page: 1 })).toBe("/categoria/destaques?q=Rare&brand=BAPE");
  });

  it("rejects noninteger, negative, nonfinite and unsafe page numbers without an invalid database offset", () => {
    for (const value of ["NaN", "Infinity", "-1", "0", "1.5", "9007199254740991", "bad"]) expect(normalizeCatalogPage(value)).toBe(1);
    expect(normalizeCatalogPage("2")).toBe(2);
    expect(CATALOG_PAGE_SIZE).toBe(24);
  });
});
