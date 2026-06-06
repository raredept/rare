import sharp from "sharp";
import { GENERATED_MEDIA_VARIANTS, type GeneratedMediaVariantKind } from "@/lib/media-variant-convention";

const MAX_INPUT_PIXELS = 40_000_000;

export const STATIC_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export type GeneratedImageVariant = {
  kind: GeneratedMediaVariantKind;
  bytes: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
};

export type GeneratedImageVariantSet = {
  sourceWidth: number;
  sourceHeight: number;
  variants: GeneratedImageVariant[];
};

export class InvalidStaticImageError extends Error {
  constructor() {
    super("Arquivo de imagem estática inválido.");
    this.name = "InvalidStaticImageError";
  }
}

function getOrientedDimensions(metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>) {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const swapsDimensions = metadata.orientation ? metadata.orientation >= 5 && metadata.orientation <= 8 : false;

  return swapsDimensions ? { width: height, height: width } : { width, height };
}

export async function generateStaticImageVariants(bytes: Buffer): Promise<GeneratedImageVariantSet | null> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

  try {
    metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
  } catch {
    throw new InvalidStaticImageError();
  }

  try {
    const source = getOrientedDimensions(metadata);

    if (!source.width || !source.height || (metadata.pages ?? 1) > 1) return null;
    if (source.width < GENERATED_MEDIA_VARIANTS.at(-1)!.width) return null;

    const variants = await Promise.all(
      GENERATED_MEDIA_VARIANTS.map(async (variant) => {
        const output = await sharp(bytes, {
          failOn: "error",
          limitInputPixels: MAX_INPUT_PIXELS,
        })
          .rotate()
          .resize({
            width: variant.width,
            withoutEnlargement: true,
          })
          .webp({
            quality: variant.quality,
            effort: 4,
          })
          .toBuffer({ resolveWithObject: true });

        return {
          kind: variant.kind,
          bytes: output.data,
          contentType: "image/webp" as const,
          width: output.info.width,
          height: output.info.height,
        };
      }),
    );

    if (
      variants.length !== GENERATED_MEDIA_VARIANTS.length ||
      variants.some((variant) => variant.width <= 0 || variant.height <= 0 || variant.bytes.length >= bytes.length)
    ) {
      return null;
    }

    return {
      sourceWidth: source.width,
      sourceHeight: source.height,
      variants,
    };
  } catch {
    throw new InvalidStaticImageError();
  }
}
