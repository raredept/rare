import { describe, expect, it } from "vitest";
import {
  buildCategoryMetadata,
  buildCategorySeoDescription,
  buildCollectionMetadata,
  buildHomeMetadata,
  getListingIndexState,
  LISTING_REFINEMENT_PARAMS,
  RARE_DEFAULT_DESCRIPTION,
} from "@/lib/seo";

// RARE-SEO-GOOGLE-01: canonical + robots strategy for listing URLs.
const productionEnv = { NODE_ENV: "production", APP_URL: "https://raredept.com.br" };
const camisetas = { kind: "category" as const, slug: "camisetas", title: "Camisetas", description: "Peças selecionadas pela RARE nesta categoria.", products: [{}] };

describe("listing index state", () => {
  it("treats every filter, sort and internal search parameter as a refinement", () => {
    expect(LISTING_REFINEMENT_PARAMS).toEqual(["q", "brand", "size", "price", "available", "promo", "sort"]);
    for (const key of LISTING_REFINEMENT_PARAMS) {
      expect(getListingIndexState({ [key]: "x" }).refined, key).toBe(true);
    }
    expect(getListingIndexState({ brand: ["Supreme", "Bape"] }).refined).toBe(true);
  });

  it("ignores empty values, tracking parameters and invalid pages", () => {
    expect(getListingIndexState({ brand: "  ", utm_source: "instagram", fbclid: "abc" })).toEqual({ page: 1, refined: false });
    expect(getListingIndexState({ page: "0" })).toEqual({ page: 1, refined: false });
    expect(getListingIndexState({ page: "-3" })).toEqual({ page: 1, refined: false });
    expect(getListingIndexState({ page: "abc" })).toEqual({ page: 1, refined: false });
    expect(getListingIndexState({ page: "3" })).toEqual({ page: 3, refined: false });
    expect(getListingIndexState(undefined)).toEqual({ page: 1, refined: false });
  });
});

describe("category metadata", () => {
  it("keeps page 1 indexable with a clean self canonical", () => {
    const metadata = buildCategoryMetadata(camisetas, productionEnv, { page: 1, refined: false });
    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/categoria/camisetas" });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.title).toBe("Camisetas");
  });

  it("keeps page 2+ indexable with a SELF canonical (never page 1) and a distinct title", () => {
    const metadata = buildCategoryMetadata(camisetas, productionEnv, { page: 2, refined: false });
    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/categoria/camisetas?page=2" });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.title).toBe("Camisetas — página 2");
    expect(metadata.openGraph).toMatchObject({ url: "https://raredept.com.br/categoria/camisetas?page=2" });
  });

  it("marks filtered, sorted or searched listings noindex,follow with the unfiltered canonical", () => {
    for (const listing of [{ page: 1, refined: true }, { page: 4, refined: true }]) {
      const metadata = buildCategoryMetadata(camisetas, productionEnv, listing);
      expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/categoria/camisetas" });
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.title).toBe("Camisetas");
    }
  });

  it("uses the real category copy for the description, never invented claims", () => {
    expect(buildCategorySeoDescription("Camisetas", "Bases fortes para o dia a dia."))
      .toBe(`Camisetas na RARE. Bases fortes para o dia a dia. ${RARE_DEFAULT_DESCRIPTION}`);
    expect(buildCategorySeoDescription("Toucas", null)).toBe(`Toucas na RARE. ${RARE_DEFAULT_DESCRIPTION}`);
    const metadata = buildCategoryMetadata(camisetas, productionEnv, { page: 1, refined: false }, buildCategorySeoDescription("Camisetas", "Bases fortes para o dia a dia."));
    expect(metadata.description).toContain("Camisetas na RARE. Bases fortes para o dia a dia.");
  });

  it("never indexes anything outside the indexable production build", () => {
    const staging = { NODE_ENV: "production", APP_ENV: "staging", APP_URL: "https://raredept.com.br" };
    expect(buildCategoryMetadata(camisetas, staging, { page: 2, refined: false }).robots).toEqual({ index: false, follow: false });
  });
});

describe("collection metadata", () => {
  const collection = { label: "Black 15% OFF", slug: "black-friday-sale", description: null };

  it("keeps promotional collections out of the index but crawlable, with a self canonical", () => {
    const metadata = buildCollectionMetadata(collection, { page: 1, refined: false }, productionEnv);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/colecao/black-friday-sale" });
    expect(metadata.title).toBe("Black 15% OFF");
    expect(metadata.description).toBe("Black 15% OFF: peças da RARE com preço promocional por tempo limitado.");
  });

  it("uses the promotion copy when it exists and canonicalizes filtered views to the collection", () => {
    const metadata = buildCollectionMetadata({ ...collection, description: "BLACK FRIDAY SALE." }, { page: 1, refined: true }, productionEnv);
    expect(metadata.description).toBe("BLACK FRIDAY SALE.");
    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/colecao/black-friday-sale" });
    expect(buildCollectionMetadata(collection, { page: 2, refined: false }, productionEnv).alternates)
      .toEqual({ canonical: "https://raredept.com.br/colecao/black-friday-sale?page=2" });
  });
});

describe("home metadata", () => {
  it("indexes the home and keeps internal search results out of the index", () => {
    const home = buildHomeMetadata(undefined, productionEnv);
    expect(home.robots).toBeUndefined();
    expect(home.title).toEqual({ absolute: "RARE — Streetwear importado e drops selecionados" });

    const search = buildHomeMetadata("  supreme  ", productionEnv);
    expect(search.robots).toEqual({ index: false, follow: true });
    expect(search.alternates).toEqual({ canonical: "https://raredept.com.br" });
    expect(search.title).toBe("Busca: supreme");
  });

  it("bounds and sanitizes the echoed search term", () => {
    const search = buildHomeMetadata(`${"a".repeat(200)} sk_live_123`, productionEnv);
    expect(String(search.title).length).toBeLessThanOrEqual(80);
    expect(JSON.stringify(buildHomeMetadata("sk_live_secretvalue", productionEnv))).not.toContain("sk_live_");
  });
});
