import type { MetadataRoute } from "next";
import { getPublicSitemapCatalogData } from "@/lib/storefront";

export const dynamic = "force-dynamic";

const CANONICAL_SITE_URL = "https://raredept.com.br";

const PUBLIC_STATIC_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/sobre", priority: 0.5 },
  { path: "/contato", priority: 0.5 },
  { path: "/politica-de-envio", priority: 0.5 },
  { path: "/privacidade-e-termos", priority: 0.4 },
  { path: "/trocas-e-devolucoes", priority: 0.5 },
] as const;

function canonicalUrl(path: string) {
  if (path === "/") return CANONICAL_SITE_URL;
  return `${CANONICAL_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function dedupeSitemapEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return Array.from(new Map(entries.map((entry) => [entry.url, entry])).values());
}

function getBaseSitemapEntries(): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_STATIC_ROUTES.map((route) => ({
      url: canonicalUrl(route.path),
      changeFrequency: "weekly" as const,
      priority: route.priority,
    })),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseEntries = getBaseSitemapEntries();

  try {
    const { categories, products, hasFeaturedProducts } = await getPublicSitemapCatalogData();
    const virtualEntries: MetadataRoute.Sitemap = [
      ...(products.length ? [{ url: canonicalUrl("/categoria/tudo"), changeFrequency: "daily" as const, priority: 0.7 }] : []),
      ...(hasFeaturedProducts ? [{ url: canonicalUrl("/categoria/destaques"), changeFrequency: "daily" as const, priority: 0.7 }] : []),
    ];

    return dedupeSitemapEntries([
      ...baseEntries,
      ...virtualEntries,
      ...categories.map((category) => ({
        url: canonicalUrl(`/categoria/${encodeURIComponent(category.slug)}`),
        lastModified: category.updatedAt,
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
    return baseEntries;
  }
}
