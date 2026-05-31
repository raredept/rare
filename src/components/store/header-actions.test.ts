import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderUtilities } from "@/components/store/header-actions";

const cartMocks = vi.hoisted(() => ({
  state: {
    count: 0,
    isOpen: false,
  },
  openCart: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    count: cartMocks.state.count,
  }),
  useCartDrawer: () => ({
    isOpen: cartMocks.state.isOpen,
    openCart: cartMocks.openCart,
  }),
}));

describe("HeaderUtilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartMocks.state.count = 0;
    cartMocks.state.isOpen = false;
  });

  it("keeps the cart count visible and exposes the cart drawer trigger", () => {
    cartMocks.state.count = 3;

    const html = renderToStaticMarkup(createElement(HeaderUtilities) as ReactElement);

    expect(html).toContain("Carrinho com 3 item(s)");
    expect(html).toContain("3 item(s) no carrinho");
    expect(html).toContain("data-cart-trigger");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">3</span>");
    expect(html).not.toContain('href="/cart"');
  });

  it("marks the cart trigger expanded when the drawer is open", () => {
    cartMocks.state.isOpen = true;

    const html = renderToStaticMarkup(createElement(HeaderUtilities) as ReactElement);

    expect(html).toContain('aria-expanded="true"');
  });
});
