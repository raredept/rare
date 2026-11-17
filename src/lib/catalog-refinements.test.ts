import { describe, expect, it } from "vitest";
import {
  applyCatalogRefinements,
  buildCatalogFacets,
  buildCatalogHref,
  compareSizeLabels,
  countActiveFilters,
  DEFAULT_CATALOG_REFINEMENTS,
  hasActiveRefinements,
  normalizeSizeLabel,
  parseCatalogRefinements,
  type RefinableProduct,
} from "@/lib/catalog-refinements";

const stock = (size: string, units = 2) => ({ size, active: true, stock: units, reservedStock: 0 });
const item = (id: string, overrides: Partial<RefinableProduct> = {}) => ({
  id,
  brand: "Corteiz",
  createdAt: new Date("2026-01-01"),
  variants: [stock("M")],
  pricing: { finalPriceInCents: 20_000, discountInCents: 0 },
  ...overrides,
});

const catalog = [
  item("cheap", { brand: "BAPE", variants: [stock("P"), stock("m")], pricing: { finalPriceInCents: 4_221, discountInCents: 0 }, createdAt: new Date("2026-03-01") }),
  item("promo", { brand: "bape ", variants: [stock("G")], pricing: { finalPriceInCents: 18_000, discountInCents: 2_000 }, createdAt: new Date("2026-05-01") }),
  item("expensive", { brand: "Stüssy", variants: [stock("GG")], pricing: { finalPriceInCents: 60_000, discountInCents: 0 }, createdAt: new Date("2026-02-01") }),
  item("sold-out", { brand: "Corteiz", variants: [stock("M", 0)], pricing: { finalPriceInCents: 1_000, discountInCents: 0 }, createdAt: new Date("2026-12-01") }),
  item("one-size", { brand: "Corteiz", variants: [stock("único")], pricing: { finalPriceInCents: 9_900, discountInCents: 0 } }),
];
const ids = (products: Array<{ id: string }>) => products.map((product) => product.id);

describe("catalog refinements (UIUX-CATALOG-001)", () => {
  it("parses the URL defensively", () => {
    expect(parseCatalogRefinements({})).toEqual(DEFAULT_CATALOG_REFINEMENTS);
    expect(parseCatalogRefinements({ size: " g ", price: "100-200", available: "1", promo: "1", sort: "price-asc" }))
      .toEqual({ size: "G", price: "100-200", available: true, promo: true, sort: "price-asc" });
    expect(parseCatalogRefinements({ price: "0-999999", sort: "random", available: "yes" })).toEqual(DEFAULT_CATALOG_REFINEMENTS);
    expect(hasActiveRefinements(DEFAULT_CATALOG_REFINEMENTS)).toBe(false);
    expect(hasActiveRefinements({ ...DEFAULT_CATALOG_REFINEMENTS, sort: "newest" })).toBe(true);
    expect(countActiveFilters({ ...DEFAULT_CATALOG_REFINEMENTS, size: "G", sort: "newest" }, "BAPE")).toBe(2);
  });

  it("normalizes and orders sizes the way a shopper reads them", () => {
    expect(normalizeSizeLabel("único")).toBe("Único");
    expect(normalizeSizeLabel("U")).toBe("Único");
    expect(["Único", "42", "GG", "P", "38", "M"].sort(compareSizeLabels)).toEqual(["P", "M", "GG", "38", "42", "Único"]);
  });

  it("filters by brand (case/spacing insensitive), purchasable size, final price band, availability and promotion", () => {
    expect(ids(applyCatalogRefinements(catalog, DEFAULT_CATALOG_REFINEMENTS, "BAPE"))).toEqual(["cheap", "promo"]);
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, size: "M" }))).toEqual(["cheap"]); // sold-out M does not count
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, price: "ate-100" }))).toEqual(["cheap", "sold-out", "one-size"]);
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, price: "400-mais" }))).toEqual(["expensive"]);
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, available: true }))).not.toContain("sold-out");
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, promo: true }))).toEqual(["promo"]);
  });

  it("sorts by final price or date and keeps sold-out pieces last", () => {
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, sort: "price-asc" }))).toEqual(["cheap", "one-size", "promo", "expensive", "sold-out"]);
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, sort: "price-desc" }))).toEqual(["expensive", "promo", "one-size", "cheap", "sold-out"]);
    expect(ids(applyCatalogRefinements(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, sort: "newest" }))).toEqual(["promo", "cheap", "expensive", "one-size", "sold-out"]);
    // Relevance keeps the catalog's own order.
    expect(ids(applyCatalogRefinements(catalog, DEFAULT_CATALOG_REFINEMENTS))).toEqual(ids(catalog));
  });

  it("offers only options that exist, counted with the other active filters", () => {
    const facets = buildCatalogFacets(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, price: "ate-100" });
    expect(facets.brands).toEqual([{ value: "BAPE", label: "BAPE", count: 1 }, { value: "Corteiz", label: "Corteiz", count: 2 }]);
    expect(facets.sizes.map((option) => option.value)).toEqual(["P", "M", "Único"]);
    // The price facet ignores its own selection: every band with products stays pickable.
    expect(facets.prices.map((option) => [option.value, option.count])).toEqual([["ate-100", 3], ["100-200", 1], ["400-mais", 1]]);
    expect(facets.promoCount).toBe(0);
    expect(buildCatalogFacets(catalog, DEFAULT_CATALOG_REFINEMENTS).promoCount).toBe(1);
  });

  it("keeps a selected option visible even when nothing matches (so it can be cleared)", () => {
    const facets = buildCatalogFacets(catalog, { ...DEFAULT_CATALOG_REFINEMENTS, size: "XGG" }, "Supreme");
    expect(facets.sizes.find((option) => option.value === "XGG")).toMatchObject({ count: 0 });
    expect(facets.brands.find((option) => option.value === "Supreme")).toMatchObject({ count: 0 });
  });

  it("builds clean URLs (empty values never reach the address)", () => {
    expect(buildCatalogHref("camisetas")).toBe("/categoria/camisetas");
    expect(buildCatalogHref("tudo", { query: "corteiz", brand: "", size: "G", price: "100-200", available: true, promo: false, sort: "price-asc", page: 2 }))
      .toBe("/categoria/tudo?q=corteiz&size=G&price=100-200&available=1&sort=price-asc&page=2");
    expect(buildCatalogHref("tudo", { sort: "relevance", page: 1 })).toBe("/categoria/tudo");
  });
});
