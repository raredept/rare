import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildCardInstallmentHint } from "@/components/store/card-installment-hint";
import { CartPageClient } from "@/components/store/cart-page-client";
import { DISABLED_CARD_INSTALLMENT_RULES, type CardInstallmentRules } from "@/lib/card-installments";

const cart = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>>, subtotalInCents: 0 }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children),
}));
vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({ items: cart.items, subtotalInCents: cart.subtotalInCents, updateQuantity: vi.fn(), removeItem: vi.fn(), syncPrices: vi.fn() }),
}));

const rules: CardInstallmentRules = { enabled: true, maxInstallments: 6, minInstallmentInCents: 1_000, surchargeBps: { 4: 600, 5: 750, 6: 900 } };
const text = (html: string) => html.replace(/ /g, " ").replace(/&#x27;/g, "'");

function renderCart({ priceInCents, shippingInCents, cardInstallmentRules }: { priceInCents: number; shippingInCents: number; cardInstallmentRules?: CardInstallmentRules }) {
  cart.items = [{ productId: "prod_1", variantId: "var_1", title: "Camiseta RARE", slug: "camiseta-rare", size: "M", priceInCents, quantity: 1, maxQuantity: 2 }];
  cart.subtotalInCents = priceInCents;
  return text(renderToStaticMarkup(createElement(CartPageClient, {
    customer: { name: "Cliente", email: "cliente@example.com", phone: null, hasCpf: true, cpfMasked: "***.456.789-**" },
    addresses: [{ id: "addr_1", label: "Casa", recipientName: null, phone: null, cep: "01001000", street: "Rua", number: "1", complement: null, neighborhood: "Centro", city: "Sao Paulo", state: "SP", isDefault: true }],
    initialSelectedAddressId: "addr_1",
    cardAvailable: true,
    pixAvailable: true,
    paymentProvider: "asaas",
    cardInstallmentRules,
    shippingSettings: { shippingMode: "fixed", fixedShippingInCents: shippingInCents, checkoutRequiresAddress: true },
    shippingConfig: { enabled: false, mode: "fixed", provider: "manual", originCepConfigured: true },
  }) as ReactElement));
}

describe("checkout (cart page) installment options", () => {
  it("lists 1x-3x without interest and 4x-6x with the surcharge AND the final total", () => {
    const html = renderCart({ priceInCents: 58_000, shippingInCents: 2_000, cardInstallmentRules: rules });
    expect(html).toContain("Parcelamento no cartão");
    expect(html).toContain("1x de R$ 600,00 sem juros");
    expect(html).toContain("2x de R$ 300,00 sem juros");
    expect(html).toContain("3x de R$ 200,00 sem juros");
    expect(html).toContain("4x de R$ 159,00 com acréscimo · Total R$ 636,00");
    expect(html).toContain("5x de R$ 129,00 com acréscimo · Total R$ 645,00");
    expect(html).toContain("6x de R$ 109,00 com acréscimo · Total R$ 654,00");
    expect(html).not.toContain("7x de");
    // Nothing is added until the shopper picks a surcharged plan (1x selected by default).
    expect(html).not.toContain("Acréscimo do parcelamento");
  });

  it("offers only the plans whose installment meets the minimum", () => {
    const html = renderCart({ priceInCents: 2_000, shippingInCents: 1_000, cardInstallmentRules: rules });
    expect(html).toContain("3x de R$ 10,00 sem juros");
    expect(html).not.toContain("4x de");
  });

  it("with installments OFF (flag or Admin): no options, no installment copy — the previous card flow", () => {
    const html = renderCart({ priceInCents: 58_000, shippingInCents: 2_000, cardInstallmentRules: DISABLED_CARD_INSTALLMENT_RULES });
    expect(html).not.toContain("Parcelamento no cartão");
    expect(html).not.toContain("sem juros");
    expect(renderCart({ priceInCents: 58_000, shippingInCents: 2_000 })).not.toContain("sem juros");
  });

  it("blocks a total below the Asaas minimum with a clear message before any request", () => {
    const html = renderCart({ priceInCents: 500, shippingInCents: 300, cardInstallmentRules: rules });
    expect(html).toContain("O valor mínimo para pagamento é de R$ 10,00. Adicione mais itens ao carrinho para continuar.");
    const submit = html.slice(html.lastIndexOf("<button", html.indexOf("Finalizar compra</button>")), html.indexOf("Finalizar compra</button>"));
    expect(submit).toContain('disabled=""');
  });
});

describe("short installment copy (product page and cart)", () => {
  it("product: interest-free value of the price, and 'até 6x' without any surcharged amount", () => {
    expect(text(buildCardInstallmentHint({ amountInCents: 59_990, rules, context: "product" }) ?? "")).toBe("ou em até 3x de R$ 199,96 sem juros · ou até 6x no cartão");
  });

  it("product: a cheap item shows only the interest-free plans its price allows", () => {
    expect(text(buildCardInstallmentHint({ amountInCents: 2_500, rules, context: "product" }) ?? "")).toBe("ou em até 2x de R$ 12,50 sem juros · ou até 6x no cartão");
  });

  it("cart: no amounts, just the policy", () => {
    expect(buildCardInstallmentHint({ amountInCents: 10_000, rules, context: "cart" })).toBe("Até 3x sem juros · ou até 6x no cartão");
    expect(buildCardInstallmentHint({ amountInCents: 10_000, rules: { ...rules, maxInstallments: 3 }, context: "cart" })).toBe("Até 3x sem juros");
  });

  it("nothing when installments are off", () => {
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules: DISABLED_CARD_INSTALLMENT_RULES, context: "product" })).toBeNull();
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules: null, context: "cart" })).toBeNull();
  });
});
