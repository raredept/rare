import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartDrawer } from "@/components/store/cart-drawer";

const cartMocks = vi.hoisted(() => ({
  state: {
    isOpen: false,
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
    count: 0,
    subtotalInCents: 0,
  },
  updateQuantity: vi.fn(),
  removeItem: vi.fn(),
  closeCart: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/produto/camiseta-rare",
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    items: cartMocks.state.items,
    count: cartMocks.state.count,
    subtotalInCents: cartMocks.state.subtotalInCents,
    updateQuantity: cartMocks.updateQuantity,
    removeItem: cartMocks.removeItem,
  }),
  useCartDrawer: () => ({
    isOpen: cartMocks.state.isOpen,
    closeCart: cartMocks.closeCart,
  }),
}));

describe("CartDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartMocks.state.isOpen = false;
    cartMocks.state.items = [];
    cartMocks.state.count = 0;
    cartMocks.state.subtotalInCents = 0;
  });

  it("starts closed without rendering the dialog", () => {
    const html = renderToStaticMarkup(createElement(CartDrawer) as ReactElement);

    expect(html).toBe("");
  });

  it("renders the empty cart state with continue and checkout actions", () => {
    cartMocks.state.isOpen = true;

    const html = renderToStaticMarkup(createElement(CartDrawer) as ReactElement);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Sua seleção");
    expect(html).toContain("Sua seleção ainda está vazia.");
    expect(html).toContain("Finalizar compra");
    expect(html).toContain("Continuar comprando");
    expect(html).not.toContain("Ver carrinho");
    expect(html.match(/href="\/finalizar-compra"/g)).toHaveLength(1);
    expect(html).not.toContain('href="/cart"');
    expect(html).toContain("Frete e prazo são calculados ao finalizar a compra.");
  });

  it("renders cart items with image, variant, quantity controls, subtotal, and remove action", () => {
    cartMocks.state.isOpen = true;
    cartMocks.state.items = [
      {
        productId: "prod-1",
        variantId: "var-1",
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        size: "M",
        image: "/uploads/products/camiseta.webp",
        priceInCents: 19990,
        quantity: 2,
        maxQuantity: 3,
      },
    ];
    cartMocks.state.count = 2;
    cartMocks.state.subtotalInCents = 39980;

    const html = renderToStaticMarkup(createElement(CartDrawer) as ReactElement);

    expect(html).toContain("2 itens");
    expect(html).toContain("Camiseta RARE");
    expect(html).toContain("/uploads/products/camiseta.webp");
    expect(html).toContain("Tamanho: M");
    expect(html).toContain("Quantidade 2");
    expect(html).toContain("Diminuir quantidade");
    expect(html).toContain("Aumentar quantidade");
    expect(html).toContain("Remover");
    expect(html).toContain("R$");
    expect(html).toContain("399,80");
  });
});
