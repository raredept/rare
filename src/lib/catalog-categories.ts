export type CatalogCategorySeed = {
  name: string;
  slug: string;
  sortOrder: number;
};

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

export function getCatalogCategorySeedSlugs() {
  return [...primaryCatalogCategories, ...accessoryCatalogSubcategories].map((category) => category.slug);
}
