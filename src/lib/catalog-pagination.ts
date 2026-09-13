export const CATALOG_PAGE_SIZE = 24;

export function normalizeCatalogPage(value?: string | number) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 && page <= Math.floor(Number.MAX_SAFE_INTEGER / CATALOG_PAGE_SIZE) ? page : 1;
}

export function buildCatalogPageHref(slug: string, params: { query?: string; brand?: string; page?: number } = {}) {
  const query = new URLSearchParams();
  if (params.query?.trim()) query.set("q", params.query.trim());
  if (params.brand?.trim()) query.set("brand", params.brand.trim());
  const page = normalizeCatalogPage(params.page);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/categoria/${encodeURIComponent(slug)}${suffix ? `?${suffix}` : ""}`;
}
