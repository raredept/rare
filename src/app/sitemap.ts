import type { MetadataRoute } from "next";
import { virtualCatalogCategories } from "@/lib/catalog-categories";
import { isVariantPurchasable } from "@/lib/stock";
import { getNavigationCategories, getProducts } from "@/lib/storefront";

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
    ...virtualCatalogCategories.map((category) => ({
      url: canonicalUrl(`/categoria/${encodeURIComponent(category.slug)}`),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseEntries = getBaseSitemapEntries();

  try {
    const [categories, products] = await Promise.all([getNavigationCategories(), getProducts()]);
    const publicCategories = categories.flatMap((category) => [category, ...category.children]);
    const publicProducts = products.filter((product) => product.variants.some((variant) => isVariantPurchasable(variant)));

    return dedupeSitemapEntries([
      ...baseEntries,
      ...publicCategories.map((category) => ({
        url: canonicalUrl(`/categoria/${encodeURIComponent(category.slug)}`),
        lastModified: category.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...publicProducts.map((product) => ({
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
