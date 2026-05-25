import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartPageClient, resolveShippingOptionSelection } from "@/components/store/cart-page-client";

const cartMocks = vi.hoisted(() => ({
  state: {
    items: [] as Array<{
      productId: string;
      variantId: string;
      title: string;
      slug: string;
      size: string;
      image?: string;
      priceInCents: number;
      quantity: number;
      maxQuantity: number;
    }>,
    subtotalInCents: 0,
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    items: cartMocks.state.items,
    subtotalInCents: cartMocks.state.subtotalInCents,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
  }),
}));

describe("CartPageClient", () => {
  it("renders an intentional empty cart state with useful storefront CTAs", () => {
    cartMocks.state.items = [];
    cartMocks.state.subtotalInCents = 0;
    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: null,
        addresses: [],
        initialSelectedAddressId: "",
        shippingSettings: {
          shippingMode: "fixed",
          fixedShippingInCents: 0,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: false,
          provider: "manual",
          originCepConfigured: false,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Sua seleção ainda está vazia.");
    expect(html).toContain("Ver destaques");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Explorar catálogo");
    expect(html).toContain('href="/categoria/tudo"');
  });

  it("renders the shipping quote controls when automatic shipping is enabled", () => {
    cartMocks.state.items = [
      {
        productId: "prod_1",
        variantId: "var_1",
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        size: "M",
        priceInCents: 10000,
        quantity: 1,
        maxQuantity: 2,
      },
    ];
    cartMocks.state.subtotalInCents = 10000;

    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: null,
        addresses: [],
        initialSelectedAddressId: "",
        shippingSettings: {
          shippingMode: "manual",
          fixedShippingInCents: 0,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: true,
          provider: "manual",
          originCepConfigured: true,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Opções de entrega");
    expect(html).toContain("Calcular frete");
    expect(html).toContain("Calcule o frete com seu CEP.");
    expect(html).toContain("Total");
    expect(html).toContain("100,00");
    expect(html).not.toContain("50,00");
  });

  it("does not show a definitive freight value from fixed settings while automatic shipping has no selected option", () => {
    cartMocks.state.items = [
      {
        productId: "prod_1",
        variantId: "var_1",
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        size: "M",
        priceInCents: 31999,
        quantity: 1,
        maxQuantity: 2,
      },
    ];
    cartMocks.state.subtotalInCents = 31999;

    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: null,
        addresses: [],
        initialSelectedAddressId: "",
        shippingSettings: {
          shippingMode: "fixed",
          fixedShippingInCents: 5000,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: true,
          provider: "manual",
          originCepConfigured: true,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Subtotal");
    expect(html).toContain("319,99");
    expect(html).toContain("Calcule o frete");
    expect(html).toContain("Calcule o frete com seu CEP.");
    expect(html).not.toContain("50,00");
    expect(html).not.toContain("369,99");
  });

  it("resolves a selected shipping option only when it still matches CEP, preference, and expiration", () => {
    const now = Date.parse("2030-01-01T12:00:00.000Z");
    const pac = {
      id: "manual:PAC",
      provider: "manual",
      service: "PAC" as const,
      label: "PAC",
      amountCents: 1990,
      deliveryEstimateText: "Chega em 5 a 9 dias úteis",
      originCep: "01001000",
      destinationCep: "01001000",
      expiresAt: "2030-01-01T12:30:00.000Z",
    };
    const sedex = {
      ...pac,
      id: "manual:SEDEX",
      service: "SEDEX" as const,
      label: "SEDEX",
      amountCents: 2990,
    };

    expect(
      resolveShippingOptionSelection([pac, sedex], {
        normalizedCep: "01001000",
        preferredOptionId: "manual:SEDEX",
        now,
      })?.id,
    ).toBe("manual:SEDEX");
    expect(resolveShippingOptionSelection([pac], { normalizedCep: "01001000", autoSelectSingle: true, now })?.id).toBe(
      "manual:PAC",
    );
    expect(
      resolveShippingOptionSelection([{ ...pac, destinationCep: "22041001" }], {
        normalizedCep: "01001000",
        autoSelectSingle: true,
        now,
      }),
    ).toBeNull();
    expect(
      resolveShippingOptionSelection([{ ...pac, expiresAt: "2030-01-01T11:59:00.000Z" }], {
        normalizedCep: "01001000",
        autoSelectSingle: true,
        now,
      }),
    ).toBeNull();
  });
});
