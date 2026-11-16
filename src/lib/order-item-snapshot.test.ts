import { describe, expect, it } from "vitest";
import {
  buildOrderItemCatalogSnapshot,
  resolveOrderItemDisplay,
  resolveOrderItemImageUrl,
  type OrderItemForDisplay,
} from "@/lib/order-item-snapshot";

const R2 = "https://media.raredept.com.br/products";
const capturedAt = new Date("2026-11-16T15:00:00.000Z");

describe("order item image priority", () => {
  it("prefers the variant image, then the product's main image, then null", () => {
    expect(resolveOrderItemImageUrl({ variantMedia: [{ url: `${R2}/var.webp` }], productMedia: [{ url: `${R2}/main.webp` }] })).toBe(`${R2}/var.webp`);
    expect(resolveOrderItemImageUrl({ variantMedia: [], productMedia: [{ url: `${R2}/main.webp` }, { url: `${R2}/back.webp` }] })).toBe(`${R2}/main.webp`);
    expect(resolveOrderItemImageUrl({ productMedia: [] })).toBeNull();
    expect(resolveOrderItemImageUrl({})).toBeNull();
  });

  it("skips a leading video and takes the first still image", () => {
    expect(resolveOrderItemImageUrl({ productMedia: [{ url: `${R2}/clip.mp4` }, { url: `${R2}/front.jpg` }] })).toBe(`${R2}/front.jpg`);
    expect(resolveOrderItemImageUrl({ productMedia: [{ url: `${R2}/clip.mp4` }] })).toBeNull();
  });

  it("never snapshots a URL outside the allowed media shapes", () => {
    expect(resolveOrderItemImageUrl({ productMedia: [{ url: "javascript:alert(1)//x.png" }, { url: "//evil.example/x.png" }] })).toBeNull();
  });
});

describe("order item catalog snapshot", () => {
  it("records SKU, image and capture time", () => {
    expect(
      buildOrderItemCatalogSnapshot({ variantSku: "CRTZ-TSH-BLK-G", productMedia: [{ url: `${R2}/main.webp` }], capturedAt }),
    ).toEqual({ skuSnapshot: "CRTZ-TSH-BLK-G", imageUrlSnapshot: `${R2}/main.webp`, catalogSnapshotAt: capturedAt });
  });

  it("records NULL (never an empty string) when the variant has no SKU and the product no image", () => {
    expect(buildOrderItemCatalogSnapshot({ variantSku: null, productMedia: [], capturedAt })).toEqual({
      skuSnapshot: null,
      imageUrlSnapshot: null,
      catalogSnapshotAt: capturedAt,
    });
    expect(buildOrderItemCatalogSnapshot({ variantSku: "  ", capturedAt }).skuSnapshot).toBeNull();
  });
});

function item(overrides: Partial<OrderItemForDisplay> = {}): OrderItemForDisplay {
  return {
    productId: "prod-1",
    variantId: "var-g",
    sizeSnapshot: "G",
    skuSnapshot: null,
    imageUrlSnapshot: null,
    catalogSnapshotAt: null,
    product: { images: [{ url: `${R2}/current.webp` }] },
    variant: { productId: "prod-1", size: "G", sku: "CRTZ-NEW-G" },
    ...overrides,
  };
}

describe("order item display", () => {
  it("shows the snapshot, untouched by later catalog changes (new SKU, new image)", () => {
    const display = resolveOrderItemDisplay(
      item({ skuSnapshot: "CRTZ-TSH-BLK-G", imageUrlSnapshot: `${R2}/at-purchase.webp`, catalogSnapshotAt: capturedAt }),
    );
    expect(display).toEqual({ imageUrl: `${R2}/at-purchase.webp`, sku: "CRTZ-TSH-BLK-G", skuSource: "order" });
  });

  it("keeps showing the order after the product is archived or deleted (relations gone)", () => {
    const display = resolveOrderItemDisplay(
      item({ skuSnapshot: "CRTZ-TSH-BLK-G", imageUrlSnapshot: `${R2}/at-purchase.webp`, catalogSnapshotAt: capturedAt, productId: null, variantId: null, product: null, variant: null }),
    );
    expect(display).toEqual({ imageUrl: `${R2}/at-purchase.webp`, sku: "CRTZ-TSH-BLK-G", skuSource: "order" });
  });

  it("hides the SKU and uses the placeholder when the snapshot says there was none", () => {
    expect(resolveOrderItemDisplay(item({ catalogSnapshotAt: capturedAt }))).toEqual({ imageUrl: null, sku: null, skuSource: null });
  });

  describe("orders created before the snapshot (no backfill)", () => {
    it("falls back to the current product image and the current SKU, labelled as current", () => {
      expect(resolveOrderItemDisplay(item())).toEqual({ imageUrl: `${R2}/current.webp`, sku: "CRTZ-NEW-G", skuSource: "current-catalog" });
    });

    it("hides the SKU when the variant no longer matches the recorded size or product", () => {
      expect(resolveOrderItemDisplay(item({ variant: { productId: "prod-1", size: "M", sku: "X-M-1" } })).sku).toBeNull();
      expect(resolveOrderItemDisplay(item({ variant: { productId: "prod-2", size: "G", sku: "X-G-1" } })).sku).toBeNull();
      expect(resolveOrderItemDisplay(item({ variantId: null, variant: null })).sku).toBeNull();
    });

    it("shows the placeholder when the product is gone or has no image", () => {
      expect(resolveOrderItemDisplay(item({ productId: null, product: null, variant: null, variantId: null }))).toEqual({ imageUrl: null, sku: null, skuSource: null });
      expect(resolveOrderItemDisplay(item({ product: { images: [] } })).imageUrl).toBeNull();
    });

    it("hides the SKU when the current variant has none", () => {
      expect(resolveOrderItemDisplay(item({ variant: { productId: "prod-1", size: "G", sku: null } }))).toMatchObject({ sku: null, skuSource: null });
    });
  });
});
