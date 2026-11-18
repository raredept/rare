import { isRestrictedAppEnv } from "@/lib/deployment-environment";
import type { Metadata } from "next";
import { normalizeCatalogPage } from "@/lib/catalog-pagination";
import { getProductMediaRenderPlan, isSafeProductOgImageUrl } from "@/lib/product-media";

export const RARE_SITE_NAME = "RARE";
export const RARE_TITLE_TEMPLATE = "%s | RARE";
export const RARE_DEFAULT_DESCRIPTION = "Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.";
export const RARE_DEFAULT_SITE_URL = "https://raredept.com.br";
export const RARE_LOCAL_SITE_URL = "http://localhost:3000";
export const RARE_DEFAULT_SOCIAL_IMAGE_PATH = "/brand/rare-logo.png";

const sensitiveMetadataPatterns = [
  /sk_(?:live|test)_[A-Za-z0-9_]+/gi,
  /whsec_[A-Za-z0-9_]+/gi,
  /\bDATABASE_URL\b/gi,
  /\bUPSTASH_REDIS_REST_TOKEN\b/gi,
  /\bR2_SECRET(?:_ACCESS_KEY)?\b/gi,
  /\bSECRET_ACCESS_KEY\b/gi,
  /\bBearer\s+[A-Za-z0-9._~+/-]+/gi,
];
type EnvLike = Record<string, string | undefined>;

export type SeoImage = {
  url: string;
  alt?: string | null;
};

type BuildPageMetadataInput = {
  title: string;
  description?: string | null;
  path: string;
  /** Listing page number; > 1 adds `?page=N` to the canonical (each page canonicalizes to itself). */
  page?: number;
  absoluteTitle?: boolean;
  images?: SeoImage[];
  robots?: Metadata["robots"];
  env?: EnvLike;
};

type CategoryMetadataData = {
  kind: "featured" | "grouped" | "category";
  slug: string;
  title: string;
  description?: string | null;
  products?: unknown[];
  sections?: Array<{ products?: unknown[]; total?: number }>;
};

type ProductMetadataData = {
  title: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  images?: SeoImage[];
};

function clean(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function isDevelopmentEnv(env: EnvLike) {
  return clean(env.NODE_ENV) === "development";
}

function isProductionEnv(env: EnvLike) {
  return clean(env.NODE_ENV) === "production";
}

export function isPublicIndexingEnabled(env: EnvLike = process.env) {
  if (!isProductionEnv(env)) return false;
  if (isRestrictedAppEnv(env)) return false;
  const configured = clean(env.APP_URL) ?? clean(env.NEXT_PUBLIC_APP_URL);
  if (!configured) return true;

  try {
    const hostname = new URL(configured).hostname.toLowerCase();
    return hostname === "raredept.com.br" || hostname === "www.raredept.com.br";
  } catch {
    return false;
  }
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") return true;
  if (normalized.startsWith("127.")) return true;
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return normalized.endsWith(".local");
}

function normalizeBaseUrl(value: string, env: EnvLike) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isProductionEnv(env) && isLocalHostname(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function sanitizeMetadataText(value: string | null | undefined, fallback = RARE_DEFAULT_DESCRIPTION) {
  let sanitized = clean(value) ?? fallback;
  for (const pattern of sensitiveMetadataPatterns) {
    sanitized = sanitized.replace(pattern, "[removido]");
  }
  return clean(sanitized) ?? fallback;
}

export function getPublicBaseUrl(env: EnvLike = process.env) {
  if (isProductionEnv(env)) return RARE_DEFAULT_SITE_URL;
  const configured = clean(env.APP_URL) ?? clean(env.NEXT_PUBLIC_APP_URL);
  const fallback = isDevelopmentEnv(env) ? RARE_LOCAL_SITE_URL : RARE_DEFAULT_SITE_URL;
  if (!configured) return fallback;
  return normalizeBaseUrl(configured, env) ?? fallback;
}

export function absoluteUrl(pathOrUrl: string, env: EnvLike = process.env) {
  const rawValue = clean(pathOrUrl) ?? "/";
  const baseUrl = getPublicBaseUrl(env);
  let url: URL;

  try {
    url = new URL(rawValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      url = new URL("/", baseUrl);
    }
  } catch {
    url = new URL(rawValue.startsWith("/") ? rawValue : `/${rawValue}`, baseUrl);
  }

  if (isProductionEnv(env) && isLocalHostname(url.hostname)) {
    url = new URL(url.pathname, RARE_DEFAULT_SITE_URL);
  }

  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";

  if (url.pathname === "/") return url.origin;
  return `${url.origin}${url.pathname}`;
}

function hasUnsafeImageSignal(value: string) {
  return sensitiveMetadataPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function isSafePublicSocialImageUrl(value: string | null | undefined, env: EnvLike = process.env) {
  const rawValue = clean(value);
  if (!rawValue) return false;
  if (!isSafeProductOgImageUrl(rawValue)) return false;
  if (hasUnsafeImageSignal(rawValue)) return false;

  try {
    const url = new URL(rawValue, getPublicBaseUrl(env));
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.search || url.hash) return false;
    if (isProductionEnv(env) && isLocalHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeSocialImage(image: SeoImage, env: EnvLike) {
  if (!isSafePublicSocialImageUrl(image.url, env)) return null;
  return {
    url: absoluteUrl(image.url, env),
    alt: sanitizeMetadataText(image.alt, RARE_SITE_NAME),
  };
}

export function getDefaultOgImage(env: EnvLike = process.env) {
  return normalizeSocialImage({ url: RARE_DEFAULT_SOCIAL_IMAGE_PATH, alt: RARE_SITE_NAME }, env);
}

function normalizeSocialImages(images: SeoImage[] | undefined, env: EnvLike) {
  const normalized = (images ?? []).flatMap((image) => {
    const socialImage = normalizeSocialImage(image, env);
    return socialImage ? [socialImage] : [];
  });

  if (normalized.length) return normalized;

  const fallback = getDefaultOgImage(env);
  return fallback ? [fallback] : [];
}

function appendSiteName(title: string) {
  return `${title} | ${RARE_SITE_NAME}`;
}

function withPageParam(canonical: string, page: number | undefined) {
  const normalized = normalizeCatalogPage(page);
  return normalized > 1 ? `${canonical}?page=${normalized}` : canonical;
}

export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
  const env = input.env ?? process.env;
  const title = sanitizeMetadataText(input.title, RARE_SITE_NAME);
  const description = sanitizeMetadataText(input.description, RARE_DEFAULT_DESCRIPTION);
  const canonical = withPageParam(absoluteUrl(input.path, env), input.page);
  const socialImages = normalizeSocialImages(input.images, env);
  const socialTitle = input.absoluteTitle ? title : appendSiteName(title);

  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      siteName: RARE_SITE_NAME,
      locale: "pt_BR",
      type: "website",
      images: socialImages.length ? socialImages : undefined,
    },
    twitter: {
      card: socialImages.length ? "summary_large_image" : "summary",
      title: socialTitle,
      description,
      images: socialImages.map((image) => image.url),
    },
    robots: isPublicIndexingEnabled(env) ? input.robots : { index: false, follow: false },
  };
}

export function buildRootMetadata(env: EnvLike = process.env): Metadata {
  const socialImages = normalizeSocialImages(undefined, env);

  return {
    metadataBase: new URL(getPublicBaseUrl(env)),
    title: {
      default: RARE_SITE_NAME,
      template: RARE_TITLE_TEMPLATE,
    },
    description: RARE_DEFAULT_DESCRIPTION,
    openGraph: {
      title: RARE_SITE_NAME,
      description: RARE_DEFAULT_DESCRIPTION,
      siteName: RARE_SITE_NAME,
      type: "website",
      locale: "pt_BR",
      images: socialImages.length ? socialImages : undefined,
    },
    twitter: {
      card: socialImages.length ? "summary_large_image" : "summary",
      title: RARE_SITE_NAME,
      description: RARE_DEFAULT_DESCRIPTION,
      images: socialImages.map((image) => image.url),
    },
    icons: {
      icon: "/brand/favicon.ico",
      shortcut: "/brand/favicon.ico",
      apple: "/brand/rare-icon-192.png",
    },
    manifest: "/manifest.webmanifest",
    robots: isPublicIndexingEnabled(env) ? undefined : { index: false, follow: false },
  };
}

export function buildNoIndexMetadata(input: Pick<BuildPageMetadataInput, "title" | "description" | "path" | "env">): Metadata {
  const env = input.env ?? process.env;

  return {
    title: {
      absolute: sanitizeMetadataText(input.title, RARE_SITE_NAME),
    },
    description: sanitizeMetadataText(input.description, RARE_DEFAULT_DESCRIPTION),
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: absoluteUrl(input.path, env),
    },
  };
}

export function isCategoryMetadataEmpty(pageData: CategoryMetadataData) {
  if (pageData.kind === "grouped") {
    return !pageData.sections?.length || pageData.sections.every((section) => (section.total ?? section.products?.length ?? 0) === 0);
  }

  return !pageData.products?.length;
}

/**
 * RARE-SEO-GOOGLE-01 — indexing of listing URLs (category, catalog, collection, home search).
 *
 * - Filters, sort and internal search (`q`, `brand`, `size`, `price`, `available`, `promo`, `sort`)
 *   only re-slice products that the unfiltered pages already link to, so every such URL is
 *   `noindex, follow` and canonicalizes to the unfiltered listing: no infinite index, links still
 *   followed. They are never in the sitemap.
 * - Pagination (`?page=N`, unfiltered) stays indexable and canonicalizes to ITSELF — Google's
 *   e-commerce pagination guidance: never point page 2+ at page 1, or deeper products lose their
 *   only crawl path (7 camisetas were reachable only from `/categoria/camisetas?page=2`).
 * - Any other parameter (utm_*, fbclid...) is ignored: the canonical drops it.
 */
export const LISTING_REFINEMENT_PARAMS = ["q", "brand", "size", "price", "available", "promo", "sort"] as const;

type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListingIndexState = { page: number; refined: boolean };

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export function getListingIndexState(searchParams: RawSearchParams | undefined): ListingIndexState {
  const params = searchParams ?? {};
  const refined = LISTING_REFINEMENT_PARAMS.some((key) => Boolean(firstParam(params[key])));
  return { page: normalizeCatalogPage(firstParam(params.page)), refined };
}

const REFINED_LISTING_ROBOTS = { index: false, follow: true } as const;

function listingTitle(title: string, listing: ListingIndexState) {
  return !listing.refined && listing.page > 1 ? `${title} — página ${listing.page}` : title;
}

export function buildCategoryMetadata(
  pageData: CategoryMetadataData,
  env: EnvLike = process.env,
  listing: ListingIndexState = { page: 1, refined: false },
  seoDescription?: string | null,
): Metadata {
  const noindex = listing.refined || isCategoryMetadataEmpty(pageData);
  return buildPageMetadata({
    title: listingTitle(pageData.title, listing),
    description: seoDescription ?? pageData.description,
    path: `/categoria/${encodeURIComponent(pageData.slug)}`,
    page: listing.refined ? 1 : listing.page,
    robots: noindex ? REFINED_LISTING_ROBOTS : undefined,
    env,
  });
}

/**
 * Meta description of a real category, from copy the store already has (the home tile line of that
 * category, then the store description) — never invented marketing.
 */
export function buildCategorySeoDescription(categoryName: string, tagline?: string | null) {
  const name = clean(categoryName) ?? RARE_SITE_NAME;
  const line = clean(tagline);
  return line ? `${name} na RARE. ${line} ${RARE_DEFAULT_DESCRIPTION}` : `${name} na RARE. ${RARE_DEFAULT_DESCRIPTION}`;
}

/**
 * Storefront collections are Promotions (Black Friday...): short-lived, and a real 404 as soon as
 * the promotion is paused or ends. They are `noindex, follow` (their products stay indexed through
 * their categories) and out of the sitemap. The page keeps a self canonical and full social tags.
 */
export function buildCollectionMetadata(
  collection: { label: string; slug: string; description?: string | null },
  listing: ListingIndexState = { page: 1, refined: false },
  env: EnvLike = process.env,
): Metadata {
  return buildPageMetadata({
    title: listingTitle(collection.label, listing),
    description: collection.description || `${collection.label}: peças da RARE com preço promocional por tempo limitado.`,
    path: `/colecao/${encodeURIComponent(collection.slug)}`,
    page: listing.refined ? 1 : listing.page,
    robots: REFINED_LISTING_ROBOTS,
    env,
  });
}

export const HOME_TITLE = "RARE — Streetwear importado e drops selecionados";

/** Home; `/?q=` (internal search results) is `noindex, follow` with the home as canonical. */
export function buildHomeMetadata(query?: string | null, env: EnvLike = process.env): Metadata {
  const search = clean(query)?.slice(0, 60);
  if (search) {
    return buildPageMetadata({
      title: `Busca: ${search}`,
      description: RARE_DEFAULT_DESCRIPTION,
      path: "/",
      robots: REFINED_LISTING_ROBOTS,
      env,
    });
  }

  return buildPageMetadata({ title: HOME_TITLE, description: RARE_DEFAULT_DESCRIPTION, path: "/", absoluteTitle: true, env });
}

export function getSocialImageForProduct(
  images: SeoImage[] | null | undefined,
  productTitle = RARE_SITE_NAME,
  env: EnvLike = process.env,
) {
  const safeProductImage = images?.flatMap((image) => {
    const renderPlan = getProductMediaRenderPlan(image, "og");
    return renderPlan.renderAs === "img" && isSafePublicSocialImageUrl(renderPlan.src, env)
      ? [{ ...image, url: renderPlan.src }]
      : [];
  })[0];

  if (safeProductImage) {
    return normalizeSocialImage(
      {
        url: safeProductImage.url,
        alt: safeProductImage.alt ?? productTitle,
      },
      env,
    );
  }

  return getDefaultOgImage(env);
}

export function buildProductMetadata(product: ProductMetadataData, env: EnvLike = process.env): Metadata {
  const description = product.shortDescription || product.description || `Veja ${product.title} no catálogo da RARE.`;
  const socialImage = getSocialImageForProduct(product.images, product.title, env);

  return buildPageMetadata({
    title: product.title,
    description,
    path: `/produto/${encodeURIComponent(product.slug)}`,
    images: socialImage ? [socialImage] : undefined,
    env,
  });
}
