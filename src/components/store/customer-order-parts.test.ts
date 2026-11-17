import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomerOrderItemRow, OrderStatusBadge, pickOrderPreviewItems, type CustomerOrderItem } from "@/components/store/customer-order-parts";
import { formatItemCount, formatOrderPaymentSummary, getOrderStatusTone } from "@/lib/order-display";

const R2 = "https://media.raredept.com.br/products";

function item(overrides: Partial<CustomerOrderItem> = {}): CustomerOrderItem {
  return {
    id: "item_1",
    productId: "prod_1",
    variantId: "var_1",
    productTitleSnapshot: "Camiseta Corteiz Alcatraz",
    sizeSnapshot: "G",
    skuSnapshot: "CRTZ-ALC-G",
    imageUrlSnapshot: `${R2}/corteiz-front-medium.webp`,
    catalogSnapshotAt: new Date("2026-11-16T12:00:00Z"),
    quantity: 2,
    unitPriceInCents: 25_000,
    totalInCents: 50_000,
    product: { images: [{ url: `${R2}/corteiz-today-medium.webp` }] },
    ...overrides,
  };
}

const text = (html: string) => html.replace(/ /g, " ");

describe("customer order item (UIUX-ORDERS-001)", () => {
  it("shows the snapshot photo, size, quantity, unit price and the SKU recorded with the order", () => {
    const html = text(renderToStaticMarkup(createElement(CustomerOrderItemRow, { item: item() })));
    expect(html).toContain("corteiz-front");
    expect(html).not.toContain("corteiz-today");
    expect(html).toContain('alt="Camiseta Corteiz Alcatraz"');
    expect(html).toContain("Tamanho G · Qtd 2 · R$ 250,00 cada");
    expect(html).toContain("Ref. CRTZ-ALC-G");
    expect(html).toContain("R$ 500,00");
  });

  it("an order from before the snapshot shows today's product photo but never guesses a SKU", () => {
    const html = renderToStaticMarkup(createElement(CustomerOrderItemRow, {
      item: item({ catalogSnapshotAt: null, imageUrlSnapshot: null, skuSnapshot: null, variant: { productId: "prod_1", size: "G", sku: "CURRENT-SKU" } }),
    }));
    expect(html).toContain("corteiz-today");
    expect(html).not.toContain("CURRENT-SKU");
    expect(html).not.toContain("Ref.");
  });

  it("no image at all: a placeholder, never a broken image", () => {
    const html = renderToStaticMarkup(createElement(CustomerOrderItemRow, { item: item({ imageUrlSnapshot: null }) }));
    expect(html).not.toContain("<img");
    expect(html).toContain("Sem imagem");
  });

  it("re-checks the stored snapshot URL before using it as an image source", () => {
    const html = renderToStaticMarkup(createElement(CustomerOrderItemRow, { item: item({ imageUrlSnapshot: "javascript:alert(1)" }) }));
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Sem imagem");
  });
});

describe("order list helpers", () => {
  it("status badge always carries the label next to the icon (not color alone)", () => {
    const html = renderToStaticMarkup(createElement(OrderStatusBadge, { status: "shipped" }));
    expect(html).toContain("Enviado");
    expect(html).toContain('aria-hidden="true"');
    expect(getOrderStatusTone("awaiting_payment")).toBe("waiting");
    expect(getOrderStatusTone("failed")).toBe("danger");
  });

  it("payment summary reads the order's own installment snapshot", () => {
    expect(formatOrderPaymentSummary({ paymentMethod: "pix" })).toBe("Pix");
    expect(formatOrderPaymentSummary({ paymentMethod: "card", paymentInstallmentCount: 8, paymentInstallmentValueInCents: 8_550 })).toBe("Cartão · 8x");
    expect(formatOrderPaymentSummary({ paymentMethod: "card", paymentInstallmentCount: 1, paymentInstallmentValueInCents: 60_000 })).toBe("Cartão");
  });

  it("item count and preview", () => {
    expect(formatItemCount(1)).toBe("1 item");
    expect(formatItemCount(20)).toBe("20 itens");
    const items = Array.from({ length: 5 }, (_, index) => item({ id: `i${index}` }));
    expect(pickOrderPreviewItems(items)).toMatchObject({ hiddenCount: 2 });
    expect(pickOrderPreviewItems(items).shown).toHaveLength(3);
    expect(pickOrderPreviewItems(items.slice(0, 2)).hiddenCount).toBe(0);
  });
});
