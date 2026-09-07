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

async function readImageMetadata(bytes: Buffer) {
  try {
    const metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new InvalidStaticImageError();
    }

    return metadata;
  } catch {
    throw new InvalidStaticImageError();
  }
}

export async function validateDecodableImage(bytes: Buffer) {
  try {
    // metadata() only reads headers. Decode every frame before preserving bytes
    // for an image that will not go through the variant encoder.
    await sharp(bytes, {
      animated: true,
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).stats();
  } catch {
    throw new InvalidStaticImageError();
  }
}

function getOrientedDimensions(metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>) {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const swapsDimensions = metadata.orientation ? metadata.orientation >= 5 && metadata.orientation <= 8 : false;

  return swapsDimensions ? { width: height, height: width } : { width, height };
}

export async function generateStaticImageVariants(bytes: Buffer): Promise<GeneratedImageVariantSet | null> {
  const metadata = await readImageMetadata(bytes);

  try {
    const source = getOrientedDimensions(metadata);

    if ((metadata.pages ?? 1) > 1 || source.width < GENERATED_MEDIA_VARIANTS.at(-1)!.width) {
      await validateDecodableImage(bytes);
      return null;
    }

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
