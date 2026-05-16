import { describe, expect, it } from "vitest";
import {
  accessoryCatalogSubcategories,
  getCatalogCategorySeedSlugs,
  groupedCatalogCategories,
  isVirtualCatalogCategorySlug,
  primaryCatalogCategories,
  virtualCatalogCategories,
} from "@/lib/catalog-categories";

describe("catalog category seeds", () => {
  it("keeps virtual public categories before database-backed categories", () => {
    expect(virtualCatalogCategories.map((category) => category.name)).toEqual(["Destaques", "Tudo"]);
    expect(isVirtualCatalogCategorySlug("destaques")).toBe(true);
    expect(isVirtualCatalogCategorySlug("tudo")).toBe(true);
    expect(isVirtualCatalogCategorySlug("camisetas")).toBe(false);
  });

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

  it("keeps the grouped catalog order stable without the accessories parent", () => {
    expect(groupedCatalogCategories.map((category) => category.name)).toEqual([
      "Camisetas",
      "Jaquetas",
      "Conjuntos",
      "Bermudas",
      "Calças",
      "Bags",
      "Bonés",
      "Cuecas",
      "Meias",
      "Óculos",
      "Relógios",
    ]);
  });
});
