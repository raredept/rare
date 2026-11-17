import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// RARE-CARD-INSTALLMENTS-02: the Admin order screen shows the catalog snapshot (image, SKU) of each
// item and the financial snapshot (surcharge, installments) of the order, side by side.

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), requireAdmin: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));
vi.mock("next/image", () => ({ default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }) }));
vi.mock("@/app/admin/(protected)/orders/actions", () => ({ requestOrderRefundAction: vi.fn(), updateOrderStatusAction: vi.fn() }));

const IMAGE = "https://media.raredept.com.br/products/corteiz-front.webp";

function order12x(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_1", orderNumber: "RARE-20261117-COMBO", status: "paid", paymentMethod: "card", paymentProvider: "asaas",
    subtotalInCents: 20_000, couponCode: "RARE10", discountInCents: 2_000, promotionDiscountInCents: 0, shippingInCents: 2_000,
    shippingMethodSnapshot: "Correios PAC", shippingCepSnapshot: "01310100", cep: null,
    paymentInstallmentCount: 12, paymentInstallmentRateBps: 1_800, paymentInstallmentFeeInCents: 3_600, paymentBaseTotalInCents: 20_000,
    paymentInstallmentValueInCents: 1_966, paymentLastInstallmentValueInCents: 1_974, totalInCents: 23_600,
    shippingAddressSnapshot: null, customer: null, customerNameSnapshot: "Ana", customerEmailSnapshot: "ana@example.com", customerPhoneSnapshot: null,
    customerDocument: null, customerCpfSnapshot: null, inventoryMovements: [], asaasPaymentId: "pay_000000000001", refundRequestedAt: null,
    items: [{
      id: "item_1", productId: "prod_1", variantId: "var_1", productTitleSnapshot: "Camiseta Corteiz", sizeSnapshot: "G", quantity: 1,
      unitPriceInCents: 20_000, totalInCents: 20_000, basePriceInCents: 20_000, promotionId: null, promotionName: null, promotionCode: null, promotionDiscountInCents: 0,
      skuSnapshot: "CRTZ-TSH-BLK-G", imageUrlSnapshot: IMAGE, catalogSnapshotAt: new Date("2026-11-17T00:00:00Z"),
      // Today's catalog differs (SKU and image changed after the sale): the order must not follow it.
      product: { images: [{ url: "https://media.raredept.com.br/products/corteiz-NEW.webp" }] },
      variant: { productId: "prod_1", size: "G", sku: "CRTZ-TSH-BLK-G-V2" },
    }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "a1", role: "SELLER_ADMIN" });
});

async function render() {
  const { default: Page } = await import("@/app/admin/(protected)/orders/[id]/page");
  return renderToStaticMarkup((await Page({ params: Promise.resolve({ id: "order_1" }) })) as ReactElement).replace(/ /g, " ");
}

describe("Admin order: SKU + image + installments on one screen", () => {
  it("shows image, product, size, SKU, quantity and price, plus subtotal, coupon, freight, surcharge, total and installments", async () => {
    mocks.findUnique.mockResolvedValue(order12x());
    const html = await render();
    expect(mocks.requireAdmin).toHaveBeenCalledWith("commerce.orders");
    expect(html).toContain(IMAGE);
    expect(html).not.toContain("corteiz-NEW");
    expect(html).toContain("Camiseta Corteiz");
    expect(html).toContain("Tamanho G · Qtd 1");
    expect(html).toContain("SKU: CRTZ-TSH-BLK-G");
    expect(html).not.toContain("CRTZ-TSH-BLK-G-V2");
    expect(html).toContain("R$ 200,00");
    expect(html).toContain("Cupom RARE10");
    expect(html).toContain("- R$ 20,00");
    expect(html).toContain("Frete");
    expect(html).toContain("Acréscimo do parcelamento (18%)");
    expect(html).toContain("+ R$ 36,00");
    expect(html).toContain("12x de R$ 19,66 (última R$ 19,74) com acréscimo");
    expect(html).toContain("Cartão de crédito");
    expect(html).toContain("R$ 236,00");
  });

  it("a Pix order shows no installment lines (and keeps its catalog snapshot)", async () => {
    mocks.findUnique.mockResolvedValue(order12x({ paymentMethod: "pix", paymentInstallmentCount: null, paymentInstallmentRateBps: null, paymentInstallmentFeeInCents: 0, paymentInstallmentValueInCents: null, totalInCents: 20_000 }));
    const html = await render();
    expect(html).not.toContain("Parcelamento");
    expect(html).not.toContain("Acréscimo do parcelamento");
    expect(html).toContain("SKU: CRTZ-TSH-BLK-G");
    expect(html).toContain(">Pix<");
  });
});
