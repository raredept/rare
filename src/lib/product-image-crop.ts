import sharp from "sharp";
import { DEFAULT_IMAGE_FRAMING, getImageFrameLayout, imageFramingSchema, PRODUCT_FRAME, type ImageFraming } from "@/lib/product-image-framing";

const inputOptions = { failOn: "error", limitInputPixels: 40_000_000 } as const;
export class ProductImageEditorError extends Error {}

function isAnimatedPng(bytes: Buffer, format: string | undefined) {
  if (format !== "png") return false;
  // libvips can expose only the first APNG frame. Recognize the animation
  // control chunk rather than silently presenting it as an editable still.
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (offset + 12 + length > bytes.length) return false;
    if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
    offset += 12 + length;
  }
  return false;
}

export async function inspectProductImage(bytes: Buffer) {
  try {
    const metadata = await sharp(bytes, inputOptions).metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp", "avif", "heif", "gif"].includes(metadata.format ?? "")) {
      throw new Error("unsupported");
    }
    const oriented = metadata.autoOrient ?? { width: metadata.width, height: metadata.height };
    const animated = (metadata.pages ?? 1) > 1 || metadata.format === "gif" || isAnimatedPng(bytes, metadata.format);
    getImageFrameLayout(oriented.width, oriented.height, DEFAULT_IMAGE_FRAMING);
    // metadata() alone cannot detect truncated images. Decode before accepting.
    await sharp(bytes, { ...inputOptions, animated: true }).stats();
    return { width: oriented.width, height: oriented.height, editable: !animated };
  } catch {
    throw new ProductImageEditorError("Imagem inválida ou acima do limite de 40 milhões de pixels.");
  }
}

export async function createProductImagePreview(bytes: Buffer) {
  const source = await inspectProductImage(bytes);
  if (!source.editable) throw new ProductImageEditorError("GIFs e animações são preservados; o editor aceita apenas imagens estáticas.");
  return sharp(bytes, inputOptions).autoOrient().resize({ width: 1200, height: 1500, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
}

export async function renderProductImageFraming(bytes: Buffer, input: ImageFraming) {
  const framing = imageFramingSchema.parse(input);
  const source = await inspectProductImage(bytes);
  if (!source.editable) throw new ProductImageEditorError("GIFs e animações são preservados; o editor aceita apenas imagens estáticas.");
  const layout = getImageFrameLayout(source.width, source.height, framing);
  // Materialize orientation before extract: browser and server coordinates agree,
  // including reflected EXIF orientations. Never use the previous edited image.
  const oriented = await sharp(bytes, inputOptions).autoOrient().png().toBuffer();
  let output;
  if (framing.mode === "cover") {
    const cropWidth = Math.min(source.width, Math.max(1, Math.round(PRODUCT_FRAME.width / layout.scale)));
    const cropHeight = Math.min(source.height, Math.max(1, Math.round(PRODUCT_FRAME.height / layout.scale)));
    const left = Math.round((source.width - cropWidth) * framing.x);
    const top = Math.round((source.height - cropHeight) * framing.y);
    output = sharp(oriented, inputOptions).extract({ left, top, width: cropWidth, height: cropHeight })
      .resize({ ...PRODUCT_FRAME, fit: "cover" });
  } else {
    const width = Math.max(1, Math.min(PRODUCT_FRAME.width, Math.round(layout.width)));
    const height = Math.max(1, Math.min(PRODUCT_FRAME.height, Math.round(layout.height)));
    const fitted = await sharp(oriented, inputOptions).resize({ width, height, fit: "inside" }).png().toBuffer({ resolveWithObject: true });
    const left = Math.round((PRODUCT_FRAME.width - fitted.info.width) * framing.x);
    const top = Math.round((PRODUCT_FRAME.height - fitted.info.height) * framing.y);
    output = sharp({ create: { ...PRODUCT_FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fitted.data, left, top }]);
  }
  return { bytes: await output.webp({ quality: 95, effort: 4 }).toBuffer(), source, framing };
}
