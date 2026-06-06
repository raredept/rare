export const PRODUCT_MEDIA_LIMIT = 10;

export type ProductMediaType = "image" | "gif" | "video" | "unknown";
export type ProductMediaContext = "card" | "detail" | "thumbnail" | "zoom" | "banner" | "og";

export type ResponsiveImageCandidate = {
  url: string;
  width: number;
  height?: number;
};

export type ProductMediaAsset = {
  url: string;
  alt?: string | null;
  width?: number;
  height?: number;
  variants?: ResponsiveImageCandidate[];
};

export type ProductImageRenderPlan = {
  mediaType: ProductMediaType;
  renderAs: "img" | "video" | "placeholder";
  src: string;
  srcSet?: string;
  width: number;
  height: number;
  sizes: string;
  loading: "eager" | "lazy";
  decoding: "async";
  fetchPriority: "high" | "low" | "auto";
  zoomable: boolean;
  safeForCard: boolean;
  safeForOg: boolean;
};

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "avif", "svg"]);
const ogImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const unsafeOgImageSignals = ["token", "signature", "signed", "private", "secret", "x-amz-", "expires", "credential", "policy"];

const renderDefaults: Record<
  ProductMediaContext,
  Pick<ProductImageRenderPlan, "width" | "height" | "sizes" | "loading" | "fetchPriority">
> = {
  card: {
    width: 640,
    height: 800,
    sizes: "(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 20vw",
    loading: "lazy",
    fetchPriority: "auto",
  },
  detail: {
    width: 1200,
    height: 1500,
    sizes: "(max-width: 1023px) 100vw, 60vw",
    loading: "eager",
    fetchPriority: "high",
  },
  thumbnail: {
    width: 180,
    height: 180,
    sizes: "(max-width: 639px) 25vw, 12vw",
    loading: "lazy",
    fetchPriority: "low",
  },
  zoom: {
    width: 1800,
    height: 2250,
    sizes: "100vw",
    loading: "eager",
    fetchPriority: "auto",
  },
  banner: {
    width: 1920,
    height: 650,
    sizes: "100vw",
    loading: "lazy",
    fetchPriority: "auto",
  },
  og: {
    width: 1200,
    height: 630,
    sizes: "1200px",
    loading: "eager",
    fetchPriority: "auto",
  },
};

function getCleanPathname(value: string) {
  try {
    return new URL(value, "https://rare.local").pathname.toLowerCase();
  } catch {
    return value.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  }
}

export function getProductMediaExtension(url: string) {
  const pathname = getCleanPathname(url);
  const fileName = pathname.split("/").pop() ?? "";
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  return extension?.toLowerCase() ?? "";
}

export function getProductMediaTypeFromUrl(url: string): ProductMediaType {
  const extension = getProductMediaExtension(url);

  if (extension === "mp4") return "video";
  if (extension === "gif") return "gif";
  if (imageExtensions.has(extension)) return "image";

  return "unknown";
}

export function getProductMediaLabel(type: ProductMediaType) {
  if (type === "video") return "Vídeo";
  if (type === "gif") return "GIF";
  if (type === "image") return "Imagem";
  return "Mídia";
}

export function isProductVideoUrl(url: string) {
  return getProductMediaTypeFromUrl(url) === "video";
}

export function isStaticProductImageUrl(url: string) {
  return getProductMediaTypeFromUrl(url) === "image";
}

export function isZoomableProductMediaUrl(url: string) {
  const mediaType = getProductMediaTypeFromUrl(url);
  return mediaType === "image" || mediaType === "gif";
}

export function isProductMediaSafeForCard(url: string) {
  const mediaType = getProductMediaTypeFromUrl(url);
  return mediaType === "image" || mediaType === "gif";
}

export function isSafeProductOgImageUrl(url: string) {
  const normalized = url.trim().toLowerCase();
  if (!normalized || normalized.includes("?") || normalized.includes("#")) return false;
  if (unsafeOgImageSignals.some((signal) => normalized.includes(signal))) return false;
  return ogImageExtensions.has(getProductMediaExtension(url));
}

export function shouldRenderProductMediaAsImage(url: string) {
  const mediaType = getProductMediaTypeFromUrl(url);
  return mediaType === "image" || mediaType === "gif";
}

export function shouldRenderProductMediaAsVideo(url: string) {
  return getProductMediaTypeFromUrl(url) === "video";
}

function getResponsiveImageCandidates(media: ProductMediaAsset) {
  const baseType = getProductMediaTypeFromUrl(media.url);
  const candidates = (media.variants ?? [])
    .filter((candidate) => {
      if (!candidate.url.trim() || !Number.isFinite(candidate.width) || candidate.width <= 0) return false;
      const candidateType = getProductMediaTypeFromUrl(candidate.url);
      return candidateType === baseType && shouldRenderProductMediaAsImage(candidate.url);
    })
    .sort((first, second) => first.width - second.width);
  const unique = new Map<number, ResponsiveImageCandidate>();

  for (const candidate of candidates) {
    if (!unique.has(candidate.width)) unique.set(candidate.width, candidate);
  }

  return [...unique.values()];
}

export function buildProductImageSrcSet(media: ProductMediaAsset) {
  const candidates = getResponsiveImageCandidates(media);
  const uniqueUrls = new Set(candidates.map((candidate) => candidate.url));
  if (candidates.length < 2 || uniqueUrls.size < 2) return undefined;
  return candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(", ");
}

function selectImageCandidate(media: ProductMediaAsset, context: ProductMediaContext) {
  if (context === "zoom") return null;
  const candidates = getResponsiveImageCandidates(media);
  if (!candidates.length) return null;
  const targetWidth = renderDefaults[context].width;
  return candidates.find((candidate) => candidate.width >= targetWidth) ?? candidates.at(-1) ?? null;
}

export function getProductMediaRenderPlan(
  media: ProductMediaAsset,
  context: ProductMediaContext,
  options: { priority?: boolean } = {},
): ProductImageRenderPlan {
  const defaults = renderDefaults[context];
  const mediaType = getProductMediaTypeFromUrl(media.url);
  const selectedCandidate = selectImageCandidate(media, context);
  const zoomable = isZoomableProductMediaUrl(media.url);
  const safeForCard = isProductMediaSafeForCard(media.url);
  const safeForOg = isSafeProductOgImageUrl(media.url);
  const contextAllowsMedia =
    (context !== "card" || safeForCard) &&
    (context !== "zoom" || zoomable) &&
    (context !== "og" || safeForOg);
  const renderAs = !contextAllowsMedia
    ? "placeholder"
    : shouldRenderProductMediaAsVideo(media.url)
    ? "video"
    : shouldRenderProductMediaAsImage(media.url)
      ? "img"
      : "placeholder";
  const priority = options.priority ?? context === "detail";
  const selectedHeight =
    selectedCandidate?.height ??
    (selectedCandidate && media.width && media.height
      ? Math.max(1, Math.round((selectedCandidate.width * media.height) / media.width))
      : undefined);

  return {
    mediaType,
    renderAs,
    src: selectedCandidate?.url ?? media.url,
    srcSet: renderAs === "img" && context !== "zoom" ? buildProductImageSrcSet(media) : undefined,
    width: selectedCandidate?.width ?? media.width ?? defaults.width,
    height: selectedHeight ?? media.height ?? defaults.height,
    sizes: defaults.sizes,
    loading: priority ? "eager" : defaults.loading,
    decoding: "async",
    fetchPriority: priority ? "high" : defaults.fetchPriority,
    zoomable,
    safeForCard,
    safeForOg,
  };
}

export function getPreferredProductCardMedia<T extends { url: string }>(media: T[]) {
  if (!media.length) return null;
  return media.find((item) => isStaticProductImageUrl(item.url)) ?? media.find((item) => getProductMediaTypeFromUrl(item.url) === "gif") ?? null;
}

export function getProductCardMediaPair<T extends { url: string }>(media: T[]) {
  const primary = getPreferredProductCardMedia(media);
  if (!primary) {
    return { primary: null, hover: null };
  }

  const hover =
    media.find((item) => item.url !== primary.url && isStaticProductImageUrl(item.url)) ?? null;

  return { primary, hover };
}

export function getProductVideoPoster<T extends { url: string }>(media: T[], videoUrl?: string) {
  return media.find((item) => item.url !== videoUrl && isStaticProductImageUrl(item.url))?.url;
}
