import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildCardInstallmentHint } from "@/components/store/card-installment-hint";
import { CartPageClient } from "@/components/store/cart-page-client";
import { APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS, DISABLED_CARD_INSTALLMENT_RULES, listCardInstallmentPlans, type CardInstallmentRules } from "@/lib/card-installments";

const cart = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>>, subtotalInCents: 0 }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children),
}));
vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({ items: cart.items, subtotalInCents: cart.subtotalInCents, updateQuantity: vi.fn(), removeItem: vi.fn(), syncPrices: vi.fn() }),
}));

const rules: CardInstallmentRules = { enabled: true, maxInstallments: 12, minInstallmentInCents: 1_000, surchargeBps: APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS };
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
  it("lists 1x-3x without interest and 4x-12x with the surcharge AND the final card total", () => {
    const html = renderCart({ priceInCents: 58_000, shippingInCents: 2_000, cardInstallmentRules: rules });
    expect(html).toContain("Parcelamento no cartão");
    expect(html).toContain("1x de R$ 600,00 sem juros");
    expect(html).toContain("2x de R$ 300,00 sem juros");
    expect(html).toContain("3x de R$ 200,00 sem juros");
    expect(html).toContain("4x de R$ 163,50 com acréscimo · Total no cartão R$ 654,00");
    expect(html).toContain("5x de R$ 132,00 com acréscimo · Total no cartão R$ 660,00");
    expect(html).toContain("6x de R$ 111,00 com acréscimo · Total no cartão R$ 666,00");
    expect(html).toContain("7x de R$ 96,85 (última R$ 96,90) com acréscimo · Total no cartão R$ 678,00");
    expect(html).toContain("8x de R$ 85,50 com acréscimo · Total no cartão R$ 684,00");
    expect(html).toContain("9x de R$ 76,66 (última R$ 76,72) com acréscimo · Total no cartão R$ 690,00");
    expect(html).toContain("10x de R$ 69,60 com acréscimo · Total no cartão R$ 696,00");
    expect(html).toContain("11x de R$ 63,81 (última R$ 63,90) com acréscimo · Total no cartão R$ 702,00");
    expect(html).toContain("12x de R$ 59,00 com acréscimo · Total no cartão R$ 708,00");
    expect(html).not.toContain("13x de");
    // Nothing is added until the shopper picks a surcharged plan (1x selected by default).
    expect(html).not.toContain("Acréscimo do parcelamento");
  });

  it("offers only the plans whose installment meets the minimum", () => {
    const html = renderCart({ priceInCents: 2_000, shippingInCents: 1_000, cardInstallmentRules: rules });
    expect(html).toContain("3x de R$ 10,00 sem juros");
    expect(html).not.toContain("4x de");
    // R$ 120,00 still allows 12x (R$ 141,60 -> R$ 11,80 >= R$ 10); R$ 50,00 stops at 5x (6x would be R$ 9,25).
    const mid = renderCart({ priceInCents: 11_000, shippingInCents: 1_000, cardInstallmentRules: rules });
    expect(mid).toContain("12x de R$ 11,80");
    const low = renderCart({ priceInCents: 4_000, shippingInCents: 1_000, cardInstallmentRules: rules });
    expect(low).toContain("5x de R$ 11,00");
    expect(low).not.toContain("6x de");
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
  it("product: short copy, no amounts (coupon, promotions and shipping may still change the total)", () => {
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules, context: "product" })).toBe("ou em até 3x sem juros · ou até 12x no cartão");
  });

  it("product: a cheap item shows only the counts its own price allows (UIUX-PDP-002)", () => {
    // R$ 25,00: 2x of R$ 12,50; 3x would be R$ 8,33 and 4x+ fall under the R$ 10,00 minimum.
    expect(buildCardInstallmentHint({ amountInCents: 2_500, rules, context: "product" })).toBe("ou em até 2x sem juros");
    // Production cases from the audit: Meia FiRE R$ 42,21 -> 4x; camiseta R$ 72,00 -> 8x; meia Bape R$ 89,10 -> 10x.
    expect(buildCardInstallmentHint({ amountInCents: 4_221, rules, context: "product" })).toBe("ou em até 3x sem juros · ou até 4x no cartão");
    expect(buildCardInstallmentHint({ amountInCents: 7_200, rules, context: "product" })).toBe("ou em até 3x sem juros · ou até 8x no cartão");
    expect(buildCardInstallmentHint({ amountInCents: 8_910, rules, context: "product" })).toBe("ou em até 3x sem juros · ou até 10x no cartão");
    // Exactly what the checkout would list for the item alone.
    expect(listCardInstallmentPlans(4_221, rules).at(-1)?.installmentCount).toBe(4);
  });

  it("product: never above the Admin maximum", () => {
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules: { ...rules, maxInstallments: 6 }, context: "product" })).toBe("ou em até 3x sem juros · ou até 6x no cartão");
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules: { ...rules, maxInstallments: 3 }, context: "product" })).toBe("ou em até 3x sem juros");
  });

  // RARE-COLLECTIONS-CART-01: the cart used the Admin maximum ("até 12x") whatever the total. It now
  // reads the plans of the total it shows, like the product page and the checkout.
  const maxFromHint = (text: string | null) => {
    if (!text) return 1;
    const card = /ou até (\d+)x no cartão/.exec(text);
    const free = /(?:Até|ou em até) (\d+)x sem juros/.exec(text);
    return Number(card?.[1] ?? free?.[1] ?? 1);
  };
  const checkoutMax = (amount: number) => listCardInstallmentPlans(amount, rules).at(-1)?.installmentCount ?? 1;

  it("cart: R$ 42,21 promises exactly what the checkout lists (4x), never 12x", () => {
    const text = buildCardInstallmentHint({ amountInCents: 4_221, rules, context: "cart" });
    expect(text).toBe(`Até 3x sem juros · ou até ${checkoutMax(4_221)}x no cartão`);
    expect(text).not.toContain("12x");
    expect(maxFromHint(text)).toBe(4);
  });

  it("cart: R$ 72,00 and R$ 600,00 follow the real plans", () => {
    expect(maxFromHint(buildCardInstallmentHint({ amountInCents: 7_200, rules, context: "cart" }))).toBe(checkoutMax(7_200));
    expect(buildCardInstallmentHint({ amountInCents: 60_000, rules, context: "cart" })).toBe("Até 3x sem juros · ou até 12x no cartão");
    // R$ 100,00 used to say 12x; 12x would be R$ 9,83 per installment, under the R$ 10,00 minimum.
    expect(buildCardInstallmentHint({ amountInCents: 10_000, rules, context: "cart" })).toBe(`Até 3x sem juros · ou até ${checkoutMax(10_000)}x no cartão`);
    expect(checkoutMax(10_000)).toBe(11);
  });

  it("cart: only interest-free counts -> no redundant card part; only 1x -> no promise at all", () => {
    expect(buildCardInstallmentHint({ amountInCents: 3_000, rules, context: "cart" })).toBe("Até 3x sem juros");
    expect(buildCardInstallmentHint({ amountInCents: 2_500, rules, context: "cart" })).toBe("Até 2x sem juros");
    expect(buildCardInstallmentHint({ amountInCents: 1_500, rules, context: "cart" })).toBeNull();
    expect(buildCardInstallmentHint({ amountInCents: 60_000, rules: { ...rules, maxInstallments: 3 }, context: "cart" })).toBe("Até 3x sem juros");
  });

  it("cart: a coupon that lowers the total lowers the promise", () => {
    expect(maxFromHint(buildCardInstallmentHint({ amountInCents: 4_690, rules, context: "cart" }))).toBe(checkoutMax(4_690));
    expect(maxFromHint(buildCardInstallmentHint({ amountInCents: 4_221, rules, context: "cart" }))).toBeLessThanOrEqual(maxFromHint(buildCardInstallmentHint({ amountInCents: 4_690, rules, context: "cart" })));
  });

  it("product, cart and checkout agree for the same amount", () => {
    for (const amount of [3_000, 4_221, 7_200, 8_910, 10_000, 30_000, 60_000]) {
      const product = maxFromHint(buildCardInstallmentHint({ amountInCents: amount, rules, context: "product" }));
      const cartMax = maxFromHint(buildCardInstallmentHint({ amountInCents: amount, rules, context: "cart" }));
      expect(product, `product ${amount}`).toBe(checkoutMax(amount));
      expect(cartMax, `cart ${amount}`).toBe(checkoutMax(amount));
    }
  });

  it("nothing when installments are off", () => {
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules: DISABLED_CARD_INSTALLMENT_RULES, context: "product" })).toBeNull();
    expect(buildCardInstallmentHint({ amountInCents: 59_990, rules: null, context: "cart" })).toBeNull();
  });
});
