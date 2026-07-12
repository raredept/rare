import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "@/components/store/mobile-navigation";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCartDrawer: () => ({ openCart: vi.fn() }),
}));

describe("MobileNavigation", () => {
  it("exposes an accessible compact menu trigger without rendering a hidden duplicate menu", () => {
    const html = renderToStaticMarkup(createElement(MobileNavigation, {
      categories: [{ id: "accessories", name: "Acessórios", slug: "acessorios", children: [{ id: "bags", name: "Bags", slug: "bags" }] }],
    }) as ReactElement);

    expect(html).toContain('aria-label="Abrir menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="store-mobile-menu"');
    expect(html).not.toContain('role="dialog"');
  });
});
