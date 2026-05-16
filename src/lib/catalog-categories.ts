export type CatalogCategorySeed = {
  name: string;
  slug: string;
  sortOrder: number;
};

export const virtualCatalogCategorySlugs = ["destaques", "tudo"] as const;

export type VirtualCatalogCategorySlug = (typeof virtualCatalogCategorySlugs)[number];

export const virtualCatalogCategories = [
  { name: "Destaques", slug: "destaques", sortOrder: -2 },
  { name: "Tudo", slug: "tudo", sortOrder: -1 },
] satisfies CatalogCategorySeed[];

export const primaryCatalogCategories = [
  { name: "Camisetas", slug: "camisetas", sortOrder: 1 },
  { name: "Jaquetas", slug: "jaquetas", sortOrder: 2 },
  { name: "Conjuntos", slug: "conjuntos", sortOrder: 3 },
  { name: "Bermudas", slug: "bermudas", sortOrder: 4 },
  { name: "Calças", slug: "calcas", sortOrder: 5 },
  { name: "Acessórios", slug: "acessorios", sortOrder: 7 },
] satisfies CatalogCategorySeed[];

export const accessoryCatalogSubcategories = [
  { name: "Bags", slug: "bags", sortOrder: 1 },
  { name: "Bonés", slug: "bones", sortOrder: 2 },
  { name: "Cuecas", slug: "cuecas", sortOrder: 3 },
  { name: "Meias", slug: "meias", sortOrder: 4 },
  { name: "Óculos", slug: "oculos", sortOrder: 5 },
  { name: "Relógios", slug: "relogios", sortOrder: 6 },
] satisfies CatalogCategorySeed[];

export const legacyAccessoryCategorySlugs = ["bolsas-bag"] as const;

export const groupedCatalogCategories = [
  ...primaryCatalogCategories.filter((category) => category.slug !== "acessorios"),
  ...accessoryCatalogSubcategories,
] satisfies CatalogCategorySeed[];

export function getCatalogCategorySeedSlugs() {
  return [...primaryCatalogCategories, ...accessoryCatalogSubcategories].map((category) => category.slug);
}

export function isVirtualCatalogCategorySlug(slug: string): slug is VirtualCatalogCategorySlug {
  return virtualCatalogCategorySlugs.includes(slug as VirtualCatalogCategorySlug);
}
