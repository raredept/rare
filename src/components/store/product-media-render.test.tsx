import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartProvider } from "@/components/store/cart-context";
import { ProductCard } from "@/components/store/product-card";
import { ProductDetailClient } from "@/components/store/product-detail-client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const baseProduct = {
  id: "prod-media",
  title: "Produto com mídia",
  slug: "produto-com-midia",
  priceInCents: 19990,
  category: { name: "Acessórios" },
  subcategory: { name: "Bags" },
  variants: [{ id: "var-1", size: "Único", stock: 3, reservedStock: 0, active: true }],
};

describe("storefront product media rendering", () => {
  it("uses image or GIF media for product cards when the first media is a video", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            { url: "/uploads/products/look.mp4", alt: "Vídeo do produto" },
            { url: "/uploads/products/look.gif", alt: "GIF do produto" },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain("/uploads/products/look.gif");
    expect(html).not.toContain("/uploads/products/look.mp4");
  });

  it("renders product detail video media with controls and thumbnails", () => {
    const html = renderToStaticMarkup(
      createElement(
        CartProvider,
        null,
        createElement(ProductDetailClient, {
          product: {
            ...baseProduct,
            shortDescription: "Produto com vídeo.",
            description: "Descrição longa.",
            images: [
              { url: "/uploads/products/look.mp4", alt: "Vídeo do produto" },
              { url: "/uploads/products/look.webp", alt: "Imagem do produto" },
            ],
          },
          productUrl: "http://localhost:3000/produto/produto-com-midia",
          whatsappMessage: "Olá",
        }),
      ) as ReactElement,
    );

    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain("Vídeo");
    expect(html).not.toContain("motion-safe:md:group-hover:scale-[1.08]");
  });
});
