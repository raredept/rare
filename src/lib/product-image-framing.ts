import { z } from "zod";

// Shared with the Admin preview. Storefront cards use the same 4:5 frame.
export const PRODUCT_FRAME = { width: 1600, height: 2000 } as const;
export const imageFramingSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["cover", "contain"]),
  zoom: z.number().finite(),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
}).strict().superRefine((value, ctx) => {
  const [minimum, maximum] = value.mode === "cover" ? [1, 3] : [0.25, 1];
  if (value.zoom < minimum || value.zoom > maximum) {
    ctx.addIssue({ code: "custom", path: ["zoom"], message: "Zoom fora do limite do modo escolhido." });
  }
});

export type ImageFraming = z.infer<typeof imageFramingSchema>;
export const DEFAULT_IMAGE_FRAMING: ImageFraming = { version: 1, mode: "cover", zoom: 1, x: 0.5, y: 0.5 };
export type ProductImageReference = { assetId: string } | { productImageId: string };
export type ProductImageEditorAsset = {
  reference: ProductImageReference;
  url: string;
  width: number;
  height: number;
  framing: ImageFraming;
  editable: boolean;
};

export function getImageFrameLayout(width: number, height: number, input: ImageFraming) {
  const framing = imageFramingSchema.parse(input);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40_000_000) {
    throw new Error("Dimensões de imagem inválidas.");
  }
  const ratios = [PRODUCT_FRAME.width / width, PRODUCT_FRAME.height / height];
  const scale = (framing.mode === "cover" ? Math.max(...ratios) : Math.min(...ratios)) * framing.zoom;
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  return {
    width: renderedWidth,
    height: renderedHeight,
    left: (PRODUCT_FRAME.width - renderedWidth) * framing.x,
    top: (PRODUCT_FRAME.height - renderedHeight) * framing.y,
    scale,
  };
}

export function editorPreviewUrl(reference: ProductImageReference) {
  return `/api/admin/product-images/editor?${new URLSearchParams(reference).toString()}`;
}
