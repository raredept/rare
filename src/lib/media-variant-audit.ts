import { hasGeneratedMediaVariants } from "@/lib/media-variant-convention";
import {
  getProductCardMediaPair,
  getProductMediaTypeFromUrl,
  isProductMediaSafeForCard,
  isSafeProductOgImageUrl,
  isZoomableProductMediaUrl,
  type ProductMediaType,
} from "@/lib/product-media";

export type MediaVariantAuditSource = "product" | "banner";
export type MediaVariantAuditField = "product-image" | "banner-desktop" | "banner-mobile";
export type MediaVariantAuditUsage = "card" | "card-hover" | "detail" | "zoom" | "banner" | "og";
export type MediaVariantAuditStatus = "complete" | "legacy" | "preserve-original" | "unknown";
export type MediaVariantAuditPriority = "high" | "medium" | "low" | "none";
export type MediaVariantAuditSizeStatus = "known" | "unknown";

export type MediaVariantAuditEntry = {
  source: MediaVariantAuditSource;
  field: MediaVariantAuditField;
  ownerId: string;
  ownerTitle: string;
  ownerSlug?: string | null;
  ownerActive: boolean;
  url: string;
  alt?: string | null;
  sortOrder?: number | null;
  knownSizeBytes?: number | null;
  usages: MediaVariantAuditUsage[];
};

export type MediaVariantAuditProduct = {
  id: string;
  title: string;
  slug?: string | null;
  active: boolean;
  images: Array<{
    id?: string;
    url: string;
    alt?: string | null;
    sortOrder?: number | null;
    sizeBytes?: number | null;
  }>;
};

export type MediaVariantAuditBanner = {
  id: string;
  title?: string | null;
  active: boolean;
  sortOrder?: number | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
};

export type MediaVariantAuditItem = MediaVariantAuditEntry & {
  mediaType: ProductMediaType;
  extension: string;
  hasVariants: boolean;
  status: MediaVariantAuditStatus;
  candidateForManualReupload: boolean;
  priority: MediaVariantAuditPriority;
  reason: string;
  safeUrl: string;
  sizeStatus: MediaVariantAuditSizeStatus;
  largeOriginal: boolean;
};

export type MediaVariantAuditSummary = {
  totalMedia: number;
  totalWithVariants: number;
  totalWithoutVariants: number;
  totalReuploadCandidates: number;
  totalPreservedOriginal: number;
  totalUnknownSize: number;
  totalLargeOriginal: number;
};

export type MediaVariantAuditReport = {
  summary: MediaVariantAuditSummary;
  items: MediaVariantAuditItem[];
  reuploadCandidates: MediaVariantAuditItem[];
  preservedOriginal: MediaVariantAuditItem[];
  legacyWithoutVariants: MediaVariantAuditItem[];
};

const DEFAULT_LARGE_MEDIA_THRESHOLD_BYTES = 1_000_000;
const sensitiveQueryKeys = [
  "token",
  "signature",
  "signed",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
  "x-amz-expires",
  "expires",
  "credential",
  "policy",
  "key",
  "secret",
  "access_token",
];

function uniqueUsages(usages: MediaVariantAuditUsage[]) {
  return [...new Set(usages)];
}

function getUrlExtension(url: string) {
  try {
    const parsed = new URL(url, "https://rare.local");
    const filename = parsed.pathname.split("/").pop() ?? "";
    return filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  } catch {
    const cleanPath = url.split(/[?#]/, 1)[0] ?? "";
    const filename = cleanPath.split("/").pop() ?? "";
    return filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  }
}

function isStaticReuploadCandidate(mediaType: ProductMediaType, extension: string) {
  if (mediaType !== "image") return false;
  return ["jpg", "jpeg", "png", "webp", "avif"].includes(extension);
}

function hasSensitiveQuery(url: URL) {
  for (const [key, value] of url.searchParams.entries()) {
    const normalizedKey = key.toLowerCase();
    const normalizedValue = value.toLowerCase();
    if (sensitiveQueryKeys.some((signal) => normalizedKey.includes(signal))) return true;
    if (/^(sk_|whsec_|pk_|rk_|bearer\s+)/i.test(value)) return true;
    if (normalizedValue.includes("signature=") || normalizedValue.includes("token=")) return true;
  }

  return false;
}

export function isPossiblySignedMediaUrl(value: string) {
  try {
    const url = new URL(value, "https://rare.local");
    if (!url.search && !url.hash) return false;
    return hasSensitiveQuery(url);
  } catch {
    return /(?:token|signature|x-amz-|credential|policy|secret|expires)=/i.test(value);
  }
}

export function maskMediaUrl(value: string, maxLength = 96) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed, "https://rare.local");
    const filename = url.pathname.split("/").filter(Boolean).pop() ?? "media";
    const hasQueryOrHash = Boolean(url.search || url.hash);
    const signed = hasQueryOrHash && hasSensitiveQuery(url);

    if (signed) {
      return url.origin === "https://rare.local"
        ? `[signed-url]/.../${filename}`
        : `[signed-url] ${url.origin}/.../${filename}`;
    }

    url.search = "";
    url.hash = "";
    const sanitized = url.origin === "https://rare.local" ? url.pathname : `${url.origin}${url.pathname}`;
    if (sanitized.length <= maxLength) return sanitized;
    return `${sanitized.slice(0, Math.max(12, maxLength - 36))}...${sanitized.slice(-32)}`;
  } catch {
    const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
    if (withoutQuery.length <= maxLength) return withoutQuery;
    return `${withoutQuery.slice(0, Math.max(12, maxLength - 36))}...${withoutQuery.slice(-32)}`;
  }
}

function getPriority(entry: MediaVariantAuditEntry, largeOriginal: boolean) {
  if (entry.ownerActive && (entry.usages.includes("card") || entry.usages.includes("banner") || entry.usages.includes("og") || largeOriginal)) {
    return "high";
  }

  if (entry.ownerActive) return "medium";
  return "low";
}

function getReason(
  mediaType: ProductMediaType,
  extension: string,
  hasVariants: boolean,
  largeOriginal: boolean,
  sizeStatus: MediaVariantAuditSizeStatus,
) {
  if (hasVariants) return "variantes thumbnail/medium detectadas pela convencao versionada";
  if (mediaType === "gif") return "GIF preservado sem processamento automatico";
  if (mediaType === "video") return "MP4 preservado como video, fora de card/zoom/OG quando aplicavel";
  if (mediaType !== "image") return "tipo de midia nao reconhecido para variantes";
  if (largeOriginal) return "imagem estatica sem variantes e tamanho conhecido acima do limite de atencao";
  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    return sizeStatus === "unknown"
      ? "PNG/JPEG legado sem variantes; tamanho nao conhecido no banco"
      : "PNG/JPEG legado sem variantes";
  }
  return "imagem estatica legada sem variantes";
}

function classifyEntry(entry: MediaVariantAuditEntry, largeMediaThresholdBytes: number): MediaVariantAuditItem {
  const mediaType = getProductMediaTypeFromUrl(entry.url);
  const extension = getUrlExtension(entry.url);
  const hasVariants = hasGeneratedMediaVariants(entry.url);
  const sizeStatus: MediaVariantAuditSizeStatus =
    typeof entry.knownSizeBytes === "number" && Number.isFinite(entry.knownSizeBytes) && entry.knownSizeBytes >= 0
      ? "known"
      : "unknown";
  const largeOriginal = sizeStatus === "known" && (entry.knownSizeBytes ?? 0) >= largeMediaThresholdBytes;
  const preserveOriginal = mediaType === "gif" || mediaType === "video";
  const candidateForManualReupload = !hasVariants && !preserveOriginal && isStaticReuploadCandidate(mediaType, extension);
  const status: MediaVariantAuditStatus = hasVariants
    ? "complete"
    : preserveOriginal
      ? "preserve-original"
      : mediaType === "image"
        ? "legacy"
        : "unknown";
  const priority = candidateForManualReupload ? getPriority(entry, largeOriginal) : "none";

  return {
    ...entry,
    mediaType,
    extension,
    hasVariants,
    status,
    candidateForManualReupload,
    priority,
    reason: getReason(mediaType, extension, hasVariants, largeOriginal, sizeStatus),
    safeUrl: maskMediaUrl(entry.url),
    sizeStatus,
    largeOriginal,
  };
}

export function buildProductMediaVariantAuditEntries(products: MediaVariantAuditProduct[]) {
  const entries: MediaVariantAuditEntry[] = [];

  for (const product of products) {
    const images = product.images
      .filter((image) => image.url.trim())
      .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0));
    const { primary, hover } = getProductCardMediaPair(images);
    const ogImage = images.find((image) => isSafeProductOgImageUrl(image.url)) ?? null;

    for (const image of images) {
      const usages: MediaVariantAuditUsage[] = ["detail"];
      if (primary?.url === image.url && isProductMediaSafeForCard(image.url)) usages.push("card");
      if (hover?.url === image.url && isProductMediaSafeForCard(image.url)) usages.push("card-hover");
      if (isZoomableProductMediaUrl(image.url)) usages.push("zoom");
      if (ogImage?.url === image.url) usages.push("og");

      entries.push({
        source: "product",
        field: "product-image",
        ownerId: product.id,
        ownerTitle: product.title,
        ownerSlug: product.slug,
        ownerActive: product.active,
        url: image.url,
        alt: image.alt,
        sortOrder: image.sortOrder,
        knownSizeBytes: image.sizeBytes,
        usages: uniqueUsages(usages),
      });
    }
  }

  return entries;
}

export function buildBannerMediaVariantAuditEntries(banners: MediaVariantAuditBanner[]) {
  const entries: MediaVariantAuditEntry[] = [];

  for (const banner of banners) {
    const title = banner.title?.trim() || `Banner ${banner.sortOrder ?? banner.id}`;

    if (banner.imageUrl?.trim()) {
      entries.push({
        source: "banner",
        field: "banner-desktop",
        ownerId: banner.id,
        ownerTitle: title,
        ownerActive: banner.active,
        url: banner.imageUrl,
        sortOrder: banner.sortOrder,
        usages: ["banner"],
      });
    }

    if (banner.mobileImageUrl?.trim()) {
      entries.push({
        source: "banner",
        field: "banner-mobile",
        ownerId: banner.id,
        ownerTitle: title,
        ownerActive: banner.active,
        url: banner.mobileImageUrl,
        sortOrder: banner.sortOrder,
        usages: ["banner"],
      });
    }
  }

  return entries;
}

export function buildMediaVariantAuditReport(
  entries: MediaVariantAuditEntry[],
  options: { largeMediaThresholdBytes?: number } = {},
): MediaVariantAuditReport {
  const threshold = options.largeMediaThresholdBytes ?? DEFAULT_LARGE_MEDIA_THRESHOLD_BYTES;
  const items = entries.map((entry) => classifyEntry(entry, threshold));
  const reuploadCandidates = items.filter((item) => item.candidateForManualReupload);
  const preservedOriginal = items.filter((item) => item.status === "preserve-original");
  const legacyWithoutVariants = items.filter((item) => item.status === "legacy");

  return {
    summary: {
      totalMedia: items.length,
      totalWithVariants: items.filter((item) => item.hasVariants).length,
      totalWithoutVariants: items.filter((item) => !item.hasVariants).length,
      totalReuploadCandidates: reuploadCandidates.length,
      totalPreservedOriginal: preservedOriginal.length,
      totalUnknownSize: items.filter((item) => item.sizeStatus === "unknown").length,
      totalLargeOriginal: items.filter((item) => item.largeOriginal).length,
    },
    items,
    reuploadCandidates,
    preservedOriginal,
    legacyWithoutVariants,
  };
}
