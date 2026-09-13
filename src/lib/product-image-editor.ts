import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage, validateUploadedImageMetadata } from "@/lib/storage";
import { readAuthorizedProductImage } from "@/lib/product-image-editor-storage";
import { inspectProductImage, ProductImageEditorError, renderProductImageFraming } from "@/lib/product-image-crop";
import { DEFAULT_IMAGE_FRAMING, imageFramingSchema, type ProductImageEditorAsset } from "@/lib/product-image-framing";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const productImageReferenceSchema = z.union([
  z.object({ assetId: id }).strict(),
  z.object({ productImageId: id }).strict(),
]);

export async function resolveProductImageReference(adminId: string, input: unknown) {
  const reference = productImageReferenceSchema.parse(input);
  if ("assetId" in reference) {
    const asset = await prisma.productMediaAsset.findUnique({ where: { id: reference.assetId } });
    if (!asset || asset.createdByAdminId !== adminId) throw new ProductImageEditorError("Mídia não autorizada para edição.");
    return { reference, url: asset.url, originalUrl: asset.originalUrl, framing: asset.framing };
  }
  // Existing product images may be edited by any fully authorized store Admin.
  const image = await prisma.productImage.findUnique({ where: { id: reference.productImageId }, select: { url: true } });
  if (!image) throw new ProductImageEditorError("Mídia não encontrada. Recarregue o produto.");
  const asset = await prisma.productMediaAsset.findUnique({ where: { url: image.url } });
  return { reference, url: image.url, originalUrl: asset?.originalUrl ?? image.url, framing: asset?.framing ?? null };
}

export async function prepareProductImageEditor(adminId: string, input: unknown): Promise<ProductImageEditorAsset> {
  const source = await resolveProductImageReference(adminId, input);
  const metadata = await inspectProductImage(await readAuthorizedProductImage(source.originalUrl));
  const framing = imageFramingSchema.safeParse(source.framing);
  return { reference: source.reference, url: source.url, ...metadata, framing: framing.success ? framing.data : DEFAULT_IMAGE_FRAMING };
}

export async function uploadProductImageForEditor(adminId: string, file: File): Promise<ProductImageEditorAsset> {
  validateUploadedImageMetadata(file, "products");
  const metadata = await inspectProductImage(Buffer.from(await file.arrayBuffer()));
  if (!metadata.editable && file.type === "image/png") {
    throw new ProductImageEditorError("PNG animado não é compatível com este upload. Use GIF ou WEBP animado para preservar a animação.");
  }
  const stored = await saveUploadedImage(file, { context: "products" });
  const asset = await prisma.productMediaAsset.create({ data: {
    url: stored.url, originalUrl: stored.url, width: metadata.width, height: metadata.height, createdByAdminId: adminId,
  } });
  return { reference: { assetId: asset.id }, url: asset.url, ...metadata, framing: DEFAULT_IMAGE_FRAMING };
}

export async function applyProductImageFraming(adminId: string, input: unknown, rawFraming: unknown): Promise<ProductImageEditorAsset> {
  const framing = imageFramingSchema.parse(rawFraming);
  const source = await resolveProductImageReference(adminId, input);
  const rendered = await renderProductImageFraming(await readAuthorizedProductImage(source.originalUrl), framing);
  const file = new File([new Uint8Array(rendered.bytes)], "enquadramento.webp", { type: "image/webp" });
  // Immutable storage writes (wx / If-None-Match) complete before the DB record.
  // The existing ProductImage is never changed here. Save Product commits its URL
  // transactionally with the rest of the form; any failure retains the old image.
  const stored = await saveUploadedImage(file, { context: "products" });
  const asset = await prisma.productMediaAsset.create({ data: {
    url: stored.url, originalUrl: source.originalUrl,
    width: rendered.source.width, height: rendered.source.height, framing, createdByAdminId: adminId,
  } });
  return { reference: { assetId: asset.id }, url: asset.url, width: asset.width, height: asset.height, framing, editable: true };
}
