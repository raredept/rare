import { buildCatalogPageHref, normalizeCatalogPage } from "@/lib/catalog-pagination";
import { formatMoney } from "@/lib/money";

/**
 * Catalog filters and sort (UIUX-CATALOG-001). Pure and server-side: every option comes from the
 * products of the current scope (category / search), never from a hardcoded list, and every sort is
 * computed on the server from data it already has.
 *
 * PRICE = the price the shopper pays now (`pricing.finalPriceInCents`, automatic promotion applied by
 * the promotions engine, which is only READ here). Coupons and shipping are not part of it.
 * Sold-out pieces always stay after the available ones, whatever the sort (same rule as before).
 */

export const CATALOG_SORTS = ["relevance", "newest", "price-asc", "price-desc"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  relevance: "Destaques",
  newest: "Mais recentes",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
};

export const CATALOG_PRICE_BANDS = [
  { key: "ate-100", min: 0, max: 10_000 },
  { key: "100-200", min: 10_000, max: 20_000 },
  { key: "200-400", min: 20_000, max: 40_000 },
  { key: "400-mais", min: 40_000, max: null },
] as const;
export type CatalogPriceBand = (typeof CATALOG_PRICE_BANDS)[number]["key"];

export function formatPriceBand(key: CatalogPriceBand) {
  const band = CATALOG_PRICE_BANDS.find((item) => item.key === key)!;
  if (band.min === 0) return `Até ${formatMoney(band.max!)}`;
  if (band.max === null) return `Acima de ${formatMoney(band.min)}`;
  return `${formatMoney(band.min)} a ${formatMoney(band.max)}`;
}

export type CatalogRefinements = {
  size?: string;
  price?: CatalogPriceBand;
  available: boolean;
  promo: boolean;
  sort: CatalogSort;
};

export const DEFAULT_CATALOG_REFINEMENTS: CatalogRefinements = { available: false, promo: false, sort: "relevance" };

type RawParam = string | string[] | undefined;
const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Unknown values are ignored (never an error page for a hand-edited URL). */
export function parseCatalogRefinements(params: { size?: RawParam; price?: RawParam; available?: RawParam; promo?: RawParam; sort?: RawParam }): CatalogRefinements {
  const size = first(params.size);
  const price = first(params.price);
  const sort = first(params.sort);
  return {
    size: size && size.length <= 20 ? normalizeSizeLabel(size) : undefined,
    price: CATALOG_PRICE_BANDS.some((band) => band.key === price) ? (price as CatalogPriceBand) : undefined,
    available: first(params.available) === "1",
    promo: first(params.promo) === "1",
    sort: CATALOG_SORTS.includes(sort as CatalogSort) ? (sort as CatalogSort) : "relevance",
  };
}

export function hasActiveRefinements(refinements: CatalogRefinements) {
  return Boolean(refinements.size || refinements.price || refinements.available || refinements.promo || refinements.sort !== "relevance");
}

/** Filters only (the sort is not a filter): the number shown on the "Filtrar" button. */
export function countActiveFilters(refinements: CatalogRefinements, brand?: string) {
  return [brand?.trim(), refinements.size, refinements.price, refinements.available, refinements.promo].filter(Boolean).length;
}

const LETTER_SIZES = ["PP", "XP", "P", "M", "G", "GG", "XG", "XGG", "EXG", "G1", "G2", "G3"];
const ONE_SIZE = /^(u|un|unico|tamanho unico|one size|os)$/;

/** "g" -> "G", "único"/"U" -> "Único", "38 " -> "38". The same label groups the same size. */
export function normalizeSizeLabel(size: string) {
  const compact = size.normalize("NFC").trim().replace(/\s+/g, " ");
  const key = compact.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (ONE_SIZE.test(key)) return "Único";
  return compact.toUpperCase();
}

export function compareSizeLabels(a: string, b: string) {
  const rank = (label: string) => {
    if (label === "Único") return [3, 0] as const;
    const letter = LETTER_SIZES.indexOf(label);
    if (letter >= 0) return [0, letter] as const;
    const number = Number.parseFloat(label.replace(",", "."));
    return Number.isFinite(number) ? ([1, number] as const) : ([2, 0] as const);
  };
  const [groupA, valueA] = rank(a);
  const [groupB, valueB] = rank(b);
  return groupA - groupB || valueA - valueB || a.localeCompare(b, "pt-BR");
}

/** The fields of a storefront product the refinements read. */
export type RefinableProduct = {
  brand: string | null;
  createdAt: Date;
  variants: { size: string; active: boolean; stock: number; reservedStock: number }[];
  pricing: { finalPriceInCents: number; discountInCents: number };
};

const isPurchasable = (variant: RefinableProduct["variants"][number]) => variant.active && variant.stock - variant.reservedStock > 0;
export const isProductAvailable = (product: RefinableProduct) => product.variants.some(isPurchasable);
const normalizeBrandKey = (brand: string) => brand.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

function inPriceBand(product: RefinableProduct, key: CatalogPriceBand) {
  const band = CATALOG_PRICE_BANDS.find((item) => item.key === key)!;
  const price = product.pricing.finalPriceInCents;
  return price >= band.min && (band.max === null || price < band.max);
}

/** Size filter: only a size the shopper can buy now counts. */
function hasSize(product: RefinableProduct, size: string) {
  return product.variants.some((variant) => isPurchasable(variant) && normalizeSizeLabel(variant.size) === size);
}

function matches(product: RefinableProduct, refinements: CatalogRefinements, brand: string | undefined, skip?: "brand" | "size" | "price" | "available" | "promo") {
  if (skip !== "brand" && brand?.trim() && normalizeBrandKey(product.brand ?? "") !== normalizeBrandKey(brand)) return false;
  if (skip !== "size" && refinements.size && !hasSize(product, refinements.size)) return false;
  if (skip !== "price" && refinements.price && !inPriceBand(product, refinements.price)) return false;
  if (skip !== "available" && refinements.available && !isProductAvailable(product)) return false;
  if (skip !== "promo" && refinements.promo && product.pricing.discountInCents <= 0) return false;
  return true;
}

/**
 * Filters then sorts. The incoming order is the catalog's own (available first, then featured /
 * sort order / newest), so "relevance" keeps it as is.
 */
export function applyCatalogRefinements<T extends RefinableProduct>(products: readonly T[], refinements: CatalogRefinements, brand?: string): T[] {
  const filtered = products.filter((product) => matches(product, refinements, brand));
  if (refinements.sort === "relevance") return filtered;
  const compare = (a: T, b: T) => {
    if (refinements.sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    const diff = a.pricing.finalPriceInCents - b.pricing.finalPriceInCents;
    return refinements.sort === "price-asc" ? diff : -diff;
  };
  // Stable partition: available first, then sold out, each sorted.
  const available = filtered.filter(isProductAvailable).sort(compare);
  const soldOut = filtered.filter((product) => !isProductAvailable(product)).sort(compare);
  return [...available, ...soldOut];
}

export type CatalogFacetOption = { value: string; label: string; count: number };
export type CatalogFacets = {
  brands: CatalogFacetOption[];
  sizes: CatalogFacetOption[];
  prices: CatalogFacetOption[];
  availableCount: number;
  promoCount: number;
};

/**
 * Options that exist in the scope. Each facet counts with the OTHER active filters applied, so a
 * number always says how many products the shopper gets by picking it. Options with no product
 * are left out, except the one currently selected (so it can be seen and cleared).
 */
export function buildCatalogFacets(products: readonly RefinableProduct[], refinements: CatalogRefinements, brand?: string): CatalogFacets {
  const brandCounts = new Map<string, { label: string; count: number }>();
  for (const product of products.filter((item) => matches(item, refinements, brand, "brand"))) {
    const label = product.brand?.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!label) continue;
    const key = normalizeBrandKey(label);
    const entry = brandCounts.get(key) ?? { label, count: 0 };
    entry.count += 1;
    brandCounts.set(key, entry);
  }

  const sizeCounts = new Map<string, number>();
  for (const product of products.filter((item) => matches(item, refinements, brand, "size"))) {
    const sizes = new Set(product.variants.filter(isPurchasable).map((variant) => normalizeSizeLabel(variant.size)).filter(Boolean));
    for (const size of sizes) sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
  }

  const priceScope = products.filter((item) => matches(item, refinements, brand, "price"));
  const prices = CATALOG_PRICE_BANDS.map((band) => ({ value: band.key, label: formatPriceBand(band.key), count: priceScope.filter((product) => inPriceBand(product, band.key)).length }));

  const keepSelected = <O extends CatalogFacetOption>(options: O[], selected: string | undefined, label?: string) => {
    const kept = options.filter((option) => option.count > 0 || option.value === selected);
    if (selected && !kept.some((option) => option.value === selected)) kept.push({ value: selected, label: label ?? selected, count: 0 } as O);
    return kept;
  };

  const selectedBrandKey = brand?.trim() ? normalizeBrandKey(brand) : undefined;
  const brands = [...brandCounts.entries()]
    .map(([key, entry]) => ({ value: entry.label, label: entry.label, count: entry.count, key }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
    .map(({ key, ...option }) => ({ ...option, value: key === selectedBrandKey ? brand!.trim() : option.value }));

  return {
    brands: keepSelected(brands, brand?.trim()),
    sizes: keepSelected([...sizeCounts.entries()].map(([value, count]) => ({ value, label: value, count })).sort((a, b) => compareSizeLabels(a.value, b.value)), refinements.size),
    prices: keepSelected(prices, refinements.price, refinements.price ? formatPriceBand(refinements.price) : undefined),
    availableCount: products.filter((item) => matches(item, refinements, brand, "available") && isProductAvailable(item)).length,
    promoCount: products.filter((item) => matches(item, refinements, brand, "promo") && item.pricing.discountInCents > 0).length,
  };
}

export type CatalogUrlState = { query?: string; brand?: string; page?: number } & Partial<CatalogRefinements>;

/** One URL builder for pagination, chips, sort and the filter form: empty values never reach the URL. */
export function buildCatalogHref(slug: string, state: CatalogUrlState = {}) {
  const base = buildCatalogPageHref(slug, { query: state.query, brand: state.brand });
  const [path, search = ""] = base.split("?");
  const query = new URLSearchParams(search);
  if (state.size) query.set("size", state.size);
  if (state.price) query.set("price", state.price);
  if (state.available) query.set("available", "1");
  if (state.promo) query.set("promo", "1");
  if (state.sort && state.sort !== "relevance") query.set("sort", state.sort);
  const page = normalizeCatalogPage(state.page);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `${path}${suffix ? `?${suffix}` : ""}`;
}
