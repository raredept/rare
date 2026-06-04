import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductDetailClient } from "@/components/store/product-detail-client";
import { formatMoney } from "@/lib/money";

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

function countOccurrences(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

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
    expect(html).toContain("Descrição completa.");
    expect(html).toContain('href="/politica-de-envio"');
    expect(html).toContain("Pagamento seguro no checkout");
    expect(html).toContain("Estoque limitado");
    expect(html).toContain('href="/trocas-e-devolucoes"');
    expect(html).toContain("Troca e devolução em até 7 dias");
    expect(html).toContain("Atendimento direto");
    expect(html).toContain("Fale com a RARE pelo WhatsApp");
  });

  it("renders the main description below the title before the price without duplicating the lower details section", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          images: [{ url: "/uploads/camiseta-rare.webp", alt: "Camiseta RARE" }],
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );
    const titleIndex = html.indexOf("<h1");
    const descriptionIndex = html.indexOf("Descrição completa.");
    const priceIndex = html.indexOf(formatMoney(product.priceInCents));

    expect(html).toContain("md:cursor-zoom-in");
    expect(html).toContain("motion-safe:md:group-hover:scale-[1.08]");
    expect(html).toContain('aria-label="Ampliar imagem do produto"');
    expect(html).toContain("md:inline-flex");
    expect(html).not.toContain("absolute inset-2");
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(descriptionIndex).toBeGreaterThan(titleIndex);
    expect(priceIndex).toBeGreaterThan(descriptionIndex);
    expect(countOccurrences(html, "Descrição completa.")).toBe(1);
    expect(html).not.toContain(">Detalhes<");
    expect(html).not.toContain("Camiseta importada selecionada.");
  });

  it("falls back to the short description and does not render an empty description block", () => {
    const htmlWithShortDescription = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          description: "",
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(htmlWithShortDescription).toContain("Camiseta importada selecionada.");

    const htmlWithoutDescription = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          shortDescription: "",
          description: "",
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(htmlWithoutDescription).not.toContain("whitespace-pre-line");
    expect(htmlWithoutDescription).not.toContain(">Detalhes<");
  });

  it("does not expose the image zoom action for MP4 media", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          images: [{ url: "/uploads/camiseta-rare.mp4", alt: "Vídeo do produto" }],
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).not.toContain('aria-label="Ampliar imagem do produto"');
    expect(html).not.toContain("motion-safe:md:group-hover:scale-[1.08]");
  });
});
