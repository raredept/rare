import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminOrderItemRow, type AdminOrderItemRowItem } from "@/components/admin/order-item-row";

const R2 = "https://media.raredept.com.br/products";

function item(overrides: Partial<AdminOrderItemRowItem> = {}): AdminOrderItemRowItem {
  return {
    id: "item-1",
    productId: "prod-1",
    variantId: "var-g",
    productTitleSnapshot: "Camiseta Corteiz",
    sizeSnapshot: "G",
    quantity: 1,
    unitPriceInCents: 1200,
    totalInCents: 1200,
    basePriceInCents: 1200,
    promotionId: null,
    promotionName: null,
    promotionCode: null,
    promotionDiscountInCents: 0,
    skuSnapshot: "CRTZ-TSH-BLK-G",
    imageUrlSnapshot: `${R2}/corteiz-rare-v1-original.jpg`,
    catalogSnapshotAt: new Date("2026-11-16T15:00:00.000Z"),
    product: { images: [{ url: `${R2}/today.webp` }] },
    variant: { productId: "prod-1", size: "G", sku: "CRTZ-CHANGED-G" },
    ...overrides,
  };
}

const render = (value: AdminOrderItemRowItem) => renderToStaticMarkup(<AdminOrderItemRow item={value} />);

describe("Admin order item row", () => {
  it("shows photo, name, size, SKU, quantity and price from the order snapshot", () => {
    const html = render(item());
    expect(html).toContain("Camiseta Corteiz");
    expect(html).toContain("Tamanho G · Qtd 1");
    expect(html).toContain("SKU: CRTZ-TSH-BLK-G");
    expect(html).toMatch(/R\$(\s|&nbsp;| )12,00/);
    // The small generated rendition, not the original upload; and not today's catalog image/SKU.
    expect(html).toContain(`${R2}/corteiz-rare-v1-thumbnail.webp`);
    expect(html).toContain('sizes="80px"');
    expect(html).not.toContain("today.webp");
    expect(html).not.toContain("CRTZ-CHANGED-G");
  });

  it("hides the SKU line entirely when there is none (no 'SKU: -', null or undefined)", () => {
    const html = render(item({ skuSnapshot: null }));
    expect(html).not.toContain("SKU");
    expect(html).not.toMatch(/null|undefined/);
  });

  it("shows a placeholder, not a broken image, when there is no image", () => {
    const html = render(item({ imageUrlSnapshot: null }));
    expect(html).toContain('data-testid="admin-order-item-placeholder"');
    expect(html).toContain("Sem imagem");
    expect(html).not.toContain("<img");
  });

  it("renders an order created before the snapshot from the current catalog, labelling the SKU as current", () => {
    const html = render(item({ skuSnapshot: null, imageUrlSnapshot: null, catalogSnapshotAt: null }));
    expect(html).toContain(`${R2}/today.webp`);
    expect(html).toContain("SKU atual: CRTZ-CHANGED-G");
    expect(html).toContain("do catálogo hoje");
    expect(html).not.toContain("SKU: CRTZ-CHANGED-G");
  });

  it("renders an old order whose product was deleted with a placeholder and no SKU", () => {
    const html = render(item({ skuSnapshot: null, imageUrlSnapshot: null, catalogSnapshotAt: null, productId: null, variantId: null, product: null, variant: null }));
    expect(html).toContain("Camiseta Corteiz");
    expect(html).toContain("Sem imagem");
    expect(html).not.toContain("SKU");
  });

  it("shows the unit price when more than one unit was bought", () => {
    const html = render(item({ quantity: 2, totalInCents: 2400 }));
    expect(html).toContain("Qtd 2");
    expect(html).toMatch(/12,00\/un\./);
  });
});
