import {
  PRODUCT_MEDIA_LIMIT,
  getProductMediaLabel,
  getProductMediaTypeFromUrl,
  type ProductMediaType,
} from "@/lib/product-media";

export { PRODUCT_MEDIA_LIMIT, getProductMediaLabel, getProductMediaTypeFromUrl, type ProductMediaType };

export type ProductImageSource = "Local" | "R2" | "Seed";

export type ProductImageSubmissionInput = {
  existingImageUrls: string[];
  uploadedUrls: string[];
  replaceImages: boolean;
};

export function normalizeProductImageUrls(urls: string[], limit = PRODUCT_MEDIA_LIMIT) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const url of urls) {
    const value = url.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= limit) break;
  }

  return normalized;
}

export function resolveProductImageSubmission({
  existingImageUrls,
  uploadedUrls,
  replaceImages,
}: ProductImageSubmissionInput) {
  const existing = normalizeProductImageUrls(existingImageUrls);
  const uploaded = normalizeProductImageUrls(uploadedUrls);

  if (replaceImages && uploaded.length) {
    return uploaded;
  }

  return normalizeProductImageUrls([...existing, ...uploaded]);
}

export function clearProductImageUrls() {
  return [] as string[];
}

export function removeProductImageUrl(urls: string[], urlToRemove: string) {
  return normalizeProductImageUrls(urls).filter((url) => url !== urlToRemove);
}

export function makeProductImagePrimary(urls: string[], urlToPromote: string) {
  const normalized = normalizeProductImageUrls(urls);
  if (!normalized.includes(urlToPromote)) return normalized;
  return [urlToPromote, ...normalized.filter((url) => url !== urlToPromote)];
}

export function moveProductImageUrl(urls: string[], urlToMove: string, direction: "left" | "right") {
  const normalized = normalizeProductImageUrls(urls);
  const index = normalized.indexOf(urlToMove);
  if (index === -1) return normalized;

  const nextIndex = direction === "left" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= normalized.length) return normalized;

  const next = [...normalized];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function appendProductImageUrls(urls: string[], urlsToAppend: string[]) {
  return normalizeProductImageUrls([...urls, ...urlsToAppend]);
}

export function classifyProductImageUrl(url: string): ProductImageSource {
  const normalized = url.trim().toLowerCase();

  if (normalized.includes("/seed-products/") || normalized.endsWith(".svg")) {
    return "Seed";
  }

  if (normalized.startsWith("/uploads") || normalized.startsWith("uploads/") || normalized.startsWith("/test-uploads")) {
    return "Local";
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return "R2";
  }

  return "Local";
}

export function abbreviateProductImageUrl(url: string, maxLength = 48) {
  if (url.length <= maxLength) return url;
  const headLength = Math.max(12, Math.floor(maxLength * 0.42));
  const tailLength = Math.max(12, maxLength - headLength - 3);
  return `${url.slice(0, headLength)}...${url.slice(-tailLength)}`;
}
