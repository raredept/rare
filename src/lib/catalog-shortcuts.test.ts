import { describe, expect, it } from "vitest";
import { buildCatalogShortcuts, getPreferredCategoryOrder, sortByPreferredCategoryOrder } from "@/lib/catalog-shortcuts";

const cat = (slug: string, name = slug) => ({ slug, name });

describe("sortByPreferredCategoryOrder", () => {
  it("applies the curated order and matches by slug or accent-insensitive name", () => {
    const sorted = sortByPreferredCategoryOrder([cat("acessorios"), cat("x", "Calças"), cat("camisetas"), cat("jaquetas")]);
    expect(sorted.map((c) => c.slug)).toEqual(["camisetas", "jaquetas", "x", "acessorios"]);
  });

  it("keeps database order for categories outside the curated list", () => {
    const sorted = sortByPreferredCategoryOrder([cat("zeta"), cat("alfa"), cat("camisetas")]);
    expect(sorted.map((c) => c.slug)).toEqual(["camisetas", "zeta", "alfa"]);
  });

  it("gives unlisted categories a middle rank, before accessories", () => {
    expect(getPreferredCategoryOrder(cat("novidades"))).toBeLessThan(getPreferredCategoryOrder(cat("acessorios")));
  });
});

describe("buildCatalogShortcuts", () => {
  it("starts with Tudo and Destaques, then only the categories it was given", () => {
    expect(buildCatalogShortcuts([cat("homologacao", "Homologação")]).map((s) => s.href)).toEqual([
      "/categoria/tudo",
      "/categoria/destaques",
      "/categoria/homologacao",
    ]);
  });

  it("does not duplicate a virtual collection that also exists as a row", () => {
    expect(buildCatalogShortcuts([cat("tudo"), cat("destaques"), cat("camisetas")]).map((s) => s.slug)).toEqual([
      "tudo",
      "destaques",
      "camisetas",
    ]);
  });

  it("encodes the slug in the href", () => {
    expect(buildCatalogShortcuts([cat("bonés")]).at(-1)?.href).toBe("/categoria/bon%C3%A9s");
  });
});
