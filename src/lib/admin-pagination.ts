export const ADMIN_PAGE_SIZE = 25;

export function normalizeAdminPage(value?: string | number | string[]) {
  if (Array.isArray(value)) return 1;
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0
    ? Math.min(page, 10_000)
    : 1;
}

export function buildAdminListHref(
  basePath: string,
  params: Record<string, string | number | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    const value = String(rawValue ?? "").trim();
    if (!value || (key === "page" && value === "1")) continue;
    query.set(key, value);
  }
  const suffix = query.toString();
  return `${basePath}${suffix ? `?${suffix}` : ""}`;
}
