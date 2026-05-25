import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartPageClient } from "@/components/store/cart-page-client";

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
    expect(html).toContain("Escolha uma opção de entrega para continuar.");
  });
});
