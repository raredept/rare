import { virtualCatalogCategories } from "@/lib/catalog-categories";

/**
 * Catalog navigation order and the catalog shortcut bar.
 *
 * The shortcut bar on the category page used to be a hardcoded list of slugs.
 * The header already derives its categories from the database — active,
 * top-level, with at least one published product — so whenever a category was
 * missing, deactivated or renamed, the header dropped it while the shortcut bar
 * kept linking it and the link returned 404. Both now read the same source and
 * the same order.
 */

type OrderableCategory = { slug: string; name: string };

const preferredCategoryOrder = new Map([
  ["camisetas", 10],
  ["jaquetas", 20],
  ["conjuntos", 30],
  ["bermudas", 40],
  ["calcas", 50],
  ["acessorios", 90],
]);

const UNLISTED_CATEGORY_ORDER = 70;

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function getPreferredCategoryOrder(category: OrderableCategory) {
  for (const value of [category.slug, category.name]) {
    const order = preferredCategoryOrder.get(normalizeCategoryKey(value));
    if (order) return order;
  }
  return UNLISTED_CATEGORY_ORDER;
}

/** Stable: categories with the same preferred order keep their database order. */
export function sortByPreferredCategoryOrder<T extends OrderableCategory>(categories: readonly T[]): T[] {
  return categories
    .map((category, index) => ({ category, index }))
    .sort((first, second) => getPreferredCategoryOrder(first.category) - getPreferredCategoryOrder(second.category) || first.index - second.index)
    .map(({ category }) => category);
}

export type CatalogShortcut = { href: string; label: string; slug: string };

/**
 * "Tudo" and "Destaques" are virtual collections and always resolve. Every
 * other shortcut comes from the navigable categories, so a shortcut exists only
 * where a category page does.
 */
export function buildCatalogShortcuts(navigableCategories: readonly OrderableCategory[]): CatalogShortcut[] {
  const virtual = [...virtualCatalogCategories]
    .sort((first, second) => second.sortOrder - first.sortOrder)
    .map((category) => ({ href: `/categoria/${category.slug}`, label: category.name, slug: category.slug }));

  const virtualSlugs = new Set(virtual.map((shortcut) => shortcut.slug));
  const real = sortByPreferredCategoryOrder(navigableCategories)
    .filter((category) => !virtualSlugs.has(category.slug))
    .map((category) => ({ href: `/categoria/${encodeURIComponent(category.slug)}`, label: category.name, slug: category.slug }));

  return [...virtual, ...real];
}
