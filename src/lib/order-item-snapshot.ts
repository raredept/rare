import { getPreferredProductCardMedia } from "@/lib/product-media";
import { isAllowedProductMediaUrl } from "@/lib/admin-product-images";

/**
 * Order item catalog snapshot (SKU + image), captured when the order is created so the order
 * history never depends on the current catalog, and the fallback used to display orders created
 * before the snapshot existed.
 *
 * The image always comes from the catalog (ProductImage rows, i.e. uploads to the authorized
 * storage), never from anything the customer sent.
 */

type CatalogMedia = { url: string };

/** Only a still image (or GIF) from an allowed origin may become an order thumbnail. */
function pickCatalogImage(media: CatalogMedia[] | null | undefined) {
  const allowed = (media ?? []).filter((item) => item.url.trim() && isAllowedProductMediaUrl(item.url.trim()));
  return getPreferredProductCardMedia(allowed)?.url.trim() ?? null;
}

/**
 * Image priority: the variant's own image, then the product's main image, then null.
 * The catalog has no per-variant image today; `variantMedia` is where it plugs in.
 */
export function resolveOrderItemImageUrl(input: { variantMedia?: CatalogMedia[] | null; productMedia?: CatalogMedia[] | null }) {
  return pickCatalogImage(input.variantMedia) ?? pickCatalogImage(input.productMedia);
}

export type OrderItemCatalogSnapshot = {
  skuSnapshot: string | null;
  imageUrlSnapshot: string | null;
  catalogSnapshotAt: Date;
};

export function buildOrderItemCatalogSnapshot(input: {
  variantSku: string | null | undefined;
  variantMedia?: CatalogMedia[] | null;
  productMedia?: CatalogMedia[] | null;
  capturedAt: Date;
}): OrderItemCatalogSnapshot {
  const sku = input.variantSku?.trim();
  return {
    skuSnapshot: sku ? sku : null,
    imageUrlSnapshot: resolveOrderItemImageUrl(input),
    catalogSnapshotAt: input.capturedAt,
  };
}

export type OrderItemForDisplay = {
  productId: string | null;
  variantId: string | null;
  sizeSnapshot: string;
  skuSnapshot: string | null;
  imageUrlSnapshot: string | null;
  catalogSnapshotAt: Date | null;
  /** Current catalog rows, loaded only to display orders without a snapshot. */
  product?: { images: CatalogMedia[] } | null;
  variant?: { productId: string; size: string; sku: string | null } | null;
};

export type OrderItemDisplay = {
  imageUrl: string | null;
  sku: string | null;
  /**
   * "order": recorded when the order was created. "current-catalog": an order from before the
   * snapshot, shown from today's catalog and labelled so; it is not the historical value.
   */
  skuSource: "order" | "current-catalog" | null;
};

export function resolveOrderItemDisplay(item: OrderItemForDisplay): OrderItemDisplay {
  if (item.catalogSnapshotAt) {
    // The snapshot is the truth, including "there was no SKU / no image".
    const sku = item.skuSnapshot?.trim() || null;
    return { imageUrl: item.imageUrlSnapshot?.trim() || null, sku, skuSource: sku ? "order" : null };
  }

  // Order created before the snapshot: snapshot (none) -> variant image -> product image -> placeholder.
  const imageUrl = item.imageUrlSnapshot?.trim() || resolveOrderItemImageUrl({ productMedia: item.product?.images });

  // SKU only when the association is still unambiguous: the item still points at a variant that
  // belongs to the same product and has the same size the order recorded.
  const variant = item.variant;
  const unambiguous =
    Boolean(variant && item.variantId && item.productId) &&
    variant!.productId === item.productId &&
    variant!.size.trim().toLowerCase() === item.sizeSnapshot.trim().toLowerCase();
  const recorded = item.skuSnapshot?.trim() || null;
  if (recorded) return { imageUrl, sku: recorded, skuSource: "order" };
  const current = unambiguous ? variant!.sku?.trim() || null : null;
  return { imageUrl, sku: current, skuSource: current ? "current-catalog" : null };
}
