import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/minha-conta/dados") }));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children),
}));

import { AccountShell } from "@/components/store/account-shell";

describe("AccountShell", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/minha-conta/dados");
  });

  // The header already has a navigation landmark; two unnamed <nav>s on the
  // same page are indistinguishable to screen readers (axe landmark-unique).
  it("names its navigation and marks the current section", () => {
    const html = renderToStaticMarkup(AccountShell({ title: "Dados", children: null }));

    expect(html).toContain('<nav aria-label="Seções da conta"');
    expect(html).toMatch(/href="\/minha-conta\/dados" aria-current="page"/);
  });

  it("keeps Pedidos active on an order detail route without marking Resumo", () => {
    usePathname.mockReturnValue("/minha-conta/pedidos/order-fixture");
    const html = renderToStaticMarkup(AccountShell({ title: "Pedido", children: null }));

    expect(html).toMatch(/href="\/minha-conta\/pedidos" aria-current="page"/);
    expect(html).not.toMatch(/href="\/minha-conta" aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("marks only Resumo on the exact account root", () => {
    usePathname.mockReturnValue("/minha-conta");
    const html = renderToStaticMarkup(AccountShell({ title: "Resumo", children: null }));

    expect(html).toMatch(/href="\/minha-conta" aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
