import type { Metadata } from "next";
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

export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
  const env = input.env ?? process.env;
  const title = sanitizeMetadataText(input.title, RARE_SITE_NAME);
  const description = sanitizeMetadataText(input.description, RARE_DEFAULT_DESCRIPTION);
  const canonical = absoluteUrl(input.path, env);
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
    robots: input.robots,
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

export function buildCategoryMetadata(pageData: CategoryMetadataData, env: EnvLike = process.env): Metadata {
  return buildPageMetadata({
    title: pageData.title,
    description: pageData.description,
    path: `/categoria/${encodeURIComponent(pageData.slug)}`,
    robots: isCategoryMetadataEmpty(pageData) ? { index: false, follow: true } : undefined,
    env,
  });
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
