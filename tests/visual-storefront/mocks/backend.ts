import { fixtureBanners, fixtureCategories, fixtureCategoryTiles, fixtureCustomer, fixtureProducts, fixtureSettings } from "../fixtures";

export function isCheckoutEnabled() { return new URLSearchParams(window.location.search).get("qaCommerce") === "enabled"; }
export function getAppUrl() { return "https://raredept.com.br"; }
export function getOptionalAdminSessionSecret() { return null; }
export function getWebPushVapidPublicKey() { return null; }
export function isProductionEnv() { return false; }
export function getNodeEnv() { return "development"; }
export function getStorageDriver() { return "local" as const; }
export function isLocalStorageAllowedInProduction() { return false; }
export function getDatabaseUrl(): never { throw new Error("Fixture QA: database access refused."); }
export function getAdminSessionSecret(): never { throw new Error("Fixture QA: credentials unavailable."); }
export function getStripeSecretKey(): never { throw new Error("Fixture QA: payment access refused."); }
export function getStripeWebhookSecret(): never { throw new Error("Fixture QA: webhook access refused."); }

export async function getStoreSettings() { return fixtureSettings; }
export async function getNavigationCategories() { return fixtureCategories; }
type ProductFilters = { query?: string; brand?: string; categorySlug?: string; featuredOnly?: boolean; limit?: number; offset?: number };
export async function getProducts(filters: ProductFilters = {}) {
  const query = filters.query?.trim().toLowerCase();
  const includeErrorMedia = new URLSearchParams(window.location.search).get("qaStates") === "all";
  let products = fixtureProducts.filter((product) => product.active
    && (includeErrorMedia || !["qa-imagem-ausente", "qa-video-ausente"].includes(product.slug))
    && (!query || `${product.title} ${product.brand}`.toLowerCase().includes(query))
    && (!filters.brand || product.brand === filters.brand)
    && (!filters.featuredOnly || product.featured)
    && (!filters.categorySlug || product.category?.slug === filters.categorySlug || product.subcategory?.slug === filters.categorySlug));
  products = products.slice(filters.offset ?? 0);
  return filters.limit ? products.slice(0, filters.limit) : products;
}
export function getFeaturedProducts(filters: ProductFilters = {}) { return getProducts({ ...filters, featuredOnly: true }); }
export function getRecentProducts(filters: ProductFilters = {}) { return getProducts(filters); }
export async function getAvailableBrandsForStore() { return ["QA Fixture"]; }
export async function getHomeCategoryTiles() { return fixtureCategoryTiles; }
export async function getProductBySlug(slug: string) { return fixtureProducts.find((product) => product.slug === slug && product.active) ?? null; }
export async function getCategoryPageData(slug: string, filters: ProductFilters & { page?: number } = {}) {
  if (slug === "tudo") {
    const products = await getProducts(filters);
    return { kind: "grouped" as const, slug, eyebrow: "Fixture QA", title: "Catálogo de fixtures", description: "Registros sintéticos em memória; nenhum catálogo real é consultado.",
      sections: fixtureCategories.map((category) => { const items = products.filter((product) => product.category?.slug === category.slug); return { name: category.name, slug: category.slug, href: `/categoria/${category.slug}`, products: items, total: items.length, hasMore: false }; }).filter((section) => section.total > 0) };
  }
  const category = fixtureCategories.flatMap((item) => [item, ...item.children]).find((item) => item.slug === slug);
  if (!category && slug !== "destaques") return null;
  const products = await getProducts({ ...filters, ...(slug === "destaques" ? { featuredOnly: true } : { categorySlug: slug }) });
  return { kind: slug === "destaques" ? "featured" as const : "category" as const, slug, eyebrow: "Fixture QA", title: category?.name ?? "Destaques de fixtures", description: "Somente fixtures locais.", products, page: filters.page ?? 1, hasMore: false };
}
export async function getHomeBannerSlidesForStore() {
  if (new URLSearchParams(window.location.search).get("qaBanners") !== "10") return fixtureBanners;
  return Array.from({ length: 10 }, (_, index) => ({ ...fixtureBanners[index % fixtureBanners.length], id: `qa-many-banner-${index + 1}`, title: `Fixture QA — Slide ${index + 1}` }));
}
export function getFallbackLoginBanner() { return { ...fixtureBanners[0], imageUrl: "/brand/rare-logo.png", mobileImageUrl: undefined, imageFit: "contain" as const }; }
export async function getLoginBanner() { return getFallbackLoginBanner(); }
export async function getCurrentCustomer() { return null; }
export async function requireCustomer() { return fixtureCustomer; }

export type CustomerActionState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };
async function unavailableAction(): Promise<CustomerActionState> { return { error: "Fixture QA: ação não executada. Não há autenticação, cadastro ou persistência neste preview." }; }
export const loginCustomerAction = unavailableAction;
export const registerCustomerAction = unavailableAction;
export const updateCustomerProfileAction = unavailableAction;
export const logoutCustomerAction = unavailableAction;
export const createCustomerAddressAction = unavailableAction;
export const updateCustomerAddressAction = unavailableAction;
export const deleteCustomerAddressAction = unavailableAction;
export const setDefaultCustomerAddressAction = unavailableAction;

export const prisma = new Proxy({}, { get(): never { throw new Error("Fixture QA: Prisma calls are forbidden, including reads."); } });
export function getPrismaClient(): never { throw new Error("Fixture QA: Prisma is unavailable."); }
export function getShippingPublicConfig() { return { enabled: false, mode: "disabled", provider: "manual", originCepConfigured: false }; }
export function getEffectiveFixedShippingInCents() { return 0; }
export function getEffectiveFreeShippingThresholdInCents() { return null; }
export function calculateProvisionalShipping() { return { shippingInCents: 0, shippingMethod: "Fixture QA — frete indisponível", shippingCep: null, warnings: [], metadata: { mode: "disabled", freeShippingApplied: false } }; }
