import { describe, expect, it } from "vitest";
import {
  accessoryCatalogSubcategories,
  getCatalogCategorySeedSlugs,
  primaryCatalogCategories,
} from "@/lib/catalog-categories";

describe("catalog category seeds", () => {
  it("keeps the public top-level navigation order stable", () => {
    expect(primaryCatalogCategories.map((category) => category.name)).toEqual([
      "Camisetas",
      "Jaquetas",
      "Conjuntos",
      "Bermudas",
      "Calças",
      "Acessórios",
    ]);
  });

  it("adds the requested accessory topics without duplicate seed slugs", () => {
    expect(accessoryCatalogSubcategories.map((category) => category.name)).toEqual([
      "Bags",
      "Bonés",
      "Cuecas",
      "Meias",
      "Óculos",
      "Relógios",
    ]);

    const slugs = getCatalogCategorySeedSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
