export type GeneratedMediaVariantKind = "thumbnail" | "medium";

export const GENERATED_MEDIA_ORIGINAL_SUFFIX = "-rare-v1-original";
export const GENERATED_MEDIA_BACKFILL_QUERY_KEY = "rare-media-variants";
export const GENERATED_MEDIA_BACKFILL_VERSION = "v1";

export const GENERATED_MEDIA_VARIANTS = [
  {
    kind: "thumbnail",
    suffix: "-rare-v1-thumbnail",
    width: 640,
    quality: 80,
  },
  {
    kind: "medium",
    suffix: "-rare-v1-medium",
    width: 1200,
    quality: 84,
  },
] as const satisfies ReadonlyArray<{
  kind: GeneratedMediaVariantKind;
  suffix: string;
  width: number;
  quality: number;
}>;

const generatedOriginalUrlPattern =
  /^(.*)-rare-v1-original\.(?:jpe?g|png|webp|avif)([?#].*)?$/i;

function getBackfilledMediaVariantsFromUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value, "https://rare.local");
  } catch {
    return [];
  }

  if (parsed.searchParams.get(GENERATED_MEDIA_BACKFILL_QUERY_KEY) !== GENERATED_MEDIA_BACKFILL_VERSION) {
    return [];
  }

  const extensionMatch = parsed.pathname.match(/^(.*)\.(?:jpe?g|png|webp|avif)$/i);
  if (!extensionMatch?.[1]) return [];

  parsed.searchParams.delete(GENERATED_MEDIA_BACKFILL_QUERY_KEY);
  const remainingSuffix = `${parsed.search}${parsed.hash}`;
  const prefix = parsed.origin === "https://rare.local" ? extensionMatch[1] : `${parsed.origin}${extensionMatch[1]}`;

  return GENERATED_MEDIA_VARIANTS.map((variant) => ({
    url: `${prefix}${variant.suffix}.webp${remainingSuffix}`,
    width: variant.width,
  }));
}

export function buildGeneratedMediaObjectKey(
  baseObjectKey: string,
  kind: "original" | GeneratedMediaVariantKind,
  originalExtension: string,
) {
  if (kind === "original") {
    return `${baseObjectKey}${GENERATED_MEDIA_ORIGINAL_SUFFIX}.${originalExtension}`;
  }

  const variant = GENERATED_MEDIA_VARIANTS.find((candidate) => candidate.kind === kind);
  if (!variant) {
    throw new Error("Variante de mídia inválida.");
  }

  return `${baseObjectKey}${variant.suffix}.webp`;
}

export function getGeneratedMediaVariantsFromUrl(url: string) {
  const match = url.match(generatedOriginalUrlPattern);
  if (!match?.[1]) return getBackfilledMediaVariantsFromUrl(url);

  const baseUrl = match[1];
  const urlSuffix = match[2] ?? "";

  return GENERATED_MEDIA_VARIANTS.map((variant) => ({
    url: `${baseUrl}${variant.suffix}.webp${urlSuffix}`,
    width: variant.width,
  }));
}

export function markBackfilledMediaUrl(url: string) {
  const parsed = new URL(url, "https://rare.local");
  parsed.searchParams.set(GENERATED_MEDIA_BACKFILL_QUERY_KEY, GENERATED_MEDIA_BACKFILL_VERSION);

  if (parsed.origin === "https://rare.local") {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  return parsed.toString();
}

export function hasGeneratedMediaVariants(url: string) {
  return getGeneratedMediaVariantsFromUrl(url).length === GENERATED_MEDIA_VARIANTS.length;
}
