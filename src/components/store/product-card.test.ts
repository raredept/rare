import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/store/product-card";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const baseProduct = {
  id: "prod-card",
  title: "Supreme Bag",
  slug: "supreme-bag",
  priceInCents: 52999,
  category: { name: "Acessórios" },
  subcategory: { name: "Bags" },
  variants: [{ stock: 3, reservedStock: 0, active: true }],
};

describe("ProductCard", () => {
  it("renders the primary image and second sorted image for hover", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            { url: "/uploads/products/front.webp", alt: "Frente" },
            { url: "/uploads/products/back.webp", alt: "Verso" },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain("/uploads/products/front.webp");
    expect(html).toContain("/uploads/products/back.webp");
    expect(html).toContain("store-product-hover-image");
  });

  it("does not render hover media when the second sorted media is video", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            { url: "/uploads/products/front.webp", alt: "Frente" },
            { url: "/uploads/products/spin.mp4", alt: "Vídeo" },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain("/uploads/products/front.webp");
    expect(html).not.toContain("/uploads/products/spin.mp4");
    expect(html).not.toContain("store-product-hover-image");
  });

  it("keeps the no-image fallback when a product has no card image", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [],
        },
      }) as ReactElement,
    );

    expect(html).toContain("Sem imagem");
  });
});
