import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductDetailClient } from "@/components/store/product-detail-client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    addItem: vi.fn(),
  }),
  useCartDrawer: () => ({
    openCart: vi.fn(),
  }),
}));

const product = {
  id: "prod-1",
  title: "Camiseta RARE",
  slug: "camiseta-rare",
  shortDescription: "Camiseta importada selecionada.",
  description: "Descrição completa.",
  priceInCents: 19990,
  images: [],
  variants: [{ id: "var-p", size: "P", stock: 2, reservedStock: 0, active: true }],
};

describe("ProductDetailClient", () => {
  it("renders product trust signals, stock copy, policy links, and media fallback", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product,
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(html).toContain("Produto sem imagem");
    expect(html).toContain("2 unidades disponíveis");
    expect(html).toContain("Frete e prazo");
    expect(html).toContain('href="/politica-de-envio"');
    expect(html).toContain("Pagamento seguro no checkout");
    expect(html).toContain("Estoque limitado");
    expect(html).toContain('href="/trocas-e-devolucoes"');
    expect(html).toContain("Troca e devolução em até 7 dias");
    expect(html).toContain("Atendimento direto");
    expect(html).toContain("Fale com a RARE pelo WhatsApp");
  });
});
