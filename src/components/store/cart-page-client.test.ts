import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartPageClient } from "@/components/store/cart-page-client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    items: [],
    subtotalInCents: 0,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
  }),
}));

describe("CartPageClient", () => {
  it("renders an intentional empty cart state with useful storefront CTAs", () => {
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
      }) as ReactElement,
    );

    expect(html).toContain("Seu carrinho está vazio");
    expect(html).toContain("Ver catálogo completo");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain("Ver destaques");
    expect(html).toContain('href="/categoria/destaques"');
  });
});
