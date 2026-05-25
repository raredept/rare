export const PRODUCT_MEDIA_LIMIT = 10;

export type ProductMediaType = "image" | "gif" | "video" | "unknown";

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "svg"]);

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

export function getPreferredProductCardMedia<T extends { url: string }>(media: T[]) {
  if (!media.length) return null;
  return media.find((item) => !isProductVideoUrl(item.url)) ?? null;
}

export function getProductCardMediaPair<T extends { url: string }>(media: T[]) {
  const primary = getPreferredProductCardMedia(media);
  if (!primary) {
    return { primary: null, hover: null };
  }

  const secondSortedMedia = media[1] ?? null;
  const hover =
    secondSortedMedia && !isProductVideoUrl(secondSortedMedia.url) && secondSortedMedia.url !== primary.url
      ? secondSortedMedia
      : null;

  return { primary, hover };
}
