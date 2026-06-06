export type GeneratedMediaVariantKind = "thumbnail" | "medium";

export const GENERATED_MEDIA_ORIGINAL_SUFFIX = "-rare-v1-original";

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
  if (!match?.[1]) return [];

  const baseUrl = match[1];
  const urlSuffix = match[2] ?? "";

  return GENERATED_MEDIA_VARIANTS.map((variant) => ({
    url: `${baseUrl}${variant.suffix}.webp${urlSuffix}`,
    width: variant.width,
  }));
}

export function hasGeneratedMediaVariants(url: string) {
  return getGeneratedMediaVariantsFromUrl(url).length === GENERATED_MEDIA_VARIANTS.length;
}
