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
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).not.toContain("srcSet=");
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

  it("renders hover media from the next usable image when the first sorted media is video", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            { url: "/uploads/products/spin.mp4", alt: "Vídeo" },
            { url: "/uploads/products/front.webp", alt: "Frente" },
            { url: "/uploads/products/back.webp", alt: "Verso" },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain("/uploads/products/front.webp");
    expect(html).toContain("/uploads/products/back.webp");
    expect(html).not.toContain("/uploads/products/spin.mp4");
    expect(html).toContain("store-product-hover-image");
  });

  it("prefers a static image over GIF in catalog cards", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            { url: "/uploads/products/spin.gif", alt: "GIF" },
            { url: "/uploads/products/front.avif", alt: "Frente" },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain("/uploads/products/front.avif");
    expect(html).not.toContain("/uploads/products/spin.gif");
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

  it("renders a real responsive srcSet when card variants are supplied", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            {
              url: "/uploads/products/front-original.webp",
              alt: "Frente",
              variants: [
                { url: "/uploads/products/front-320.webp", width: 320, height: 400 },
                { url: "/uploads/products/front-640.webp", width: 640, height: 800 },
                { url: "/uploads/products/front-1200.webp", width: 1200, height: 1500 },
              ],
            },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain('src="/uploads/products/front-640.webp"');
    expect(html).toContain(
      'srcSet="/uploads/products/front-320.webp 320w, /uploads/products/front-640.webp 640w, /uploads/products/front-1200.webp 1200w"',
    );
  });

  it("uses persisted thumbnail and srcSet inferred from a new server-routed upload URL", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: {
          ...baseProduct,
          images: [
            {
              url: "/uploads/products/2026/06/id-front-rare-v1-original.png",
              alt: "Frente",
            },
          ],
        },
      }) as ReactElement,
    );

    expect(html).toContain('src="/uploads/products/2026/06/id-front-rare-v1-thumbnail.webp"');
    expect(html).toContain(
      'srcSet="/uploads/products/2026/06/id-front-rare-v1-thumbnail.webp 640w, /uploads/products/2026/06/id-front-rare-v1-medium.webp 1200w"',
    );
  });
});
