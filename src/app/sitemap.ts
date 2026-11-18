import type { MetadataRoute } from "next";
import { getPublicSitemapCatalogData } from "@/lib/storefront";

export const dynamic = "force-dynamic";

const CANONICAL_SITE_URL = "https://raredept.com.br";

const PUBLIC_STATIC_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/sobre", priority: 0.5 },
  { path: "/contato", priority: 0.5 },
  { path: "/suporte", priority: 0.5 },
  { path: "/politica-de-envio", priority: 0.5 },
  { path: "/privacidade-e-termos", priority: 0.4 },
  { path: "/politica-de-cookies", priority: 0.3 },
  { path: "/trocas-e-devolucoes", priority: 0.5 },
] as const;

function canonicalUrl(path: string) {
  if (path === "/") return CANONICAL_SITE_URL;
  return `${CANONICAL_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function dedupeSitemapEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return Array.from(new Map(entries.map((entry) => [entry.url, entry])).values());
}

function getBaseSitemapEntries(homeLastModified?: Date): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_STATIC_ROUTES.map((route) => ({
      url: canonicalUrl(route.path),
      // RARE-SEO-GOOGLE-01: only a REAL lastmod. The home lists products, so it changes when they do;
      // institutional pages have no tracked edit date, so they carry none (never `new Date()`).
      ...(route.path === "/" && homeLastModified ? { lastModified: homeLastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: route.priority,
    })),
  ];
}

type SitemapProduct = {
  updatedAt: Date;
  featured?: boolean;
  category?: { slug: string } | null;
  subcategory?: { slug: string } | null;
};

function latest(dates: Array<Date | null | undefined>) {
  let result: Date | undefined;
  for (const date of dates) {
    if (date && !Number.isNaN(date.getTime()) && (!result || date > result)) result = date;
  }
  return result;
}

/** A listing page changes when the category itself or any product it lists changes. */
function getLatestProductUpdateByCategorySlug(products: SitemapProduct[]) {
  const bySlug = new Map<string, Date>();
  for (const product of products) {
    for (const slug of [product.category?.slug, product.subcategory?.slug]) {
      if (!slug) continue;
      const current = bySlug.get(slug);
      if (!current || product.updatedAt > current) bySlug.set(slug, product.updatedAt);
    }
  }
  return bySlug;
}

/**
 * Only indexable, canonical URLs: home, institutional pages, real categories with products,
 * /categoria/tudo, /categoria/destaques (when there are featured products) and active products.
 * Never: Admin, API, checkout, cart, account, internal search, filtered/sorted/paginated listings,
 * promotional collections (/colecao/*, noindex) or the Merchant feed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { categories, products, hasFeaturedProducts } = await getPublicSitemapCatalogData();
    const catalogLastModified = latest(products.map((product) => product.updatedAt));
    const featuredLastModified = latest(products.filter((product) => product.featured).map((product) => product.updatedAt));
    const latestByCategory = getLatestProductUpdateByCategorySlug(products);
    const virtualEntries: MetadataRoute.Sitemap = [
      ...(products.length ? [{ url: canonicalUrl("/categoria/tudo"), lastModified: catalogLastModified, changeFrequency: "daily" as const, priority: 0.7 }] : []),
      ...(hasFeaturedProducts ? [{ url: canonicalUrl("/categoria/destaques"), lastModified: featuredLastModified, changeFrequency: "daily" as const, priority: 0.7 }] : []),
    ];

    return dedupeSitemapEntries([
      ...getBaseSitemapEntries(catalogLastModified),
      ...virtualEntries,
      ...categories.map((category) => ({
        url: canonicalUrl(`/categoria/${encodeURIComponent(category.slug)}`),
        lastModified: latest([category.updatedAt, latestByCategory.get(category.slug)]),
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...products.map((product) => ({
        url: canonicalUrl(`/produto/${encodeURIComponent(product.slug)}`),
        lastModified: product.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ]);
  } catch {
    console.error("Failed to build public sitemap.");
    return getBaseSitemapEntries();
  }
}
