import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeBrandsStrip } from "@/components/store/home-brands-strip";
import { HomeFeaturedCarousel, type HomeFeaturedSlide } from "@/components/store/home-featured-carousel";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children) }));

const product: HomeFeaturedSlide = { id: "qa-home", title: "Peça em destaque", slug: "peca-destaque", priceInCents: 12345, soldOut: true, image: { url: "/uploads/products/qa-rare-v1-original.png", alt: "Frente da peça" } };

describe("Home discovery", () => {
  it("hides an empty brand source and deduplicates real spelling without padding a short list", () => {
    expect(renderToStaticMarkup(createElement(HomeBrandsStrip, { brands: [] }))).toBe("");
    const html = renderToStaticMarkup(createElement(HomeBrandsStrip, { brands: [" STÜSSY ", "stüssy", "Nike"] }));
    expect((html.match(/<li /g) ?? [])).lengthOf(2);
    expect(html).toContain("STÜSSY");
    expect(html).toContain("Nike");
    expect(html).not.toContain("data-motion-control");
  });

  it("keeps the loop copy out of the accessibility tree and provides a persistent motion control", () => {
    const html = renderToStaticMarkup(createElement(HomeBrandsStrip, { brands: ["Nike", "Oakley", "STÜSSY", "Supreme"] }));
    expect((html.match(/<ul/g) ?? [])).lengthOf(2);
    expect(html).toContain('<ul aria-hidden="true"');
    expect(html).toContain("data-motion-control");
    expect(html).not.toContain("tabindex");
  });

  it("preserves one real featured product as a static linked slide with sold-out state and optimized lazy media", () => {
    const html = renderToStaticMarkup(createElement(HomeFeaturedCarousel, { products: [product] }));
    expect(html).toContain('href="/produto/peca-destaque"');
    expect(html).toContain("Esgotado");
    expect(html).toContain("123,45");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("-thumbnail.webp");
    expect(html).not.toContain('aria-label="Próximo produto em destaque"');
    expect(html).not.toContain("data-motion-control");
  });

  it("renders only the active slide, without loading every product image, and leaves an empty source to its parent fallback", () => {
    expect(renderToStaticMarkup(createElement(HomeFeaturedCarousel, { products: [] }))).toBe("");
    const html = renderToStaticMarkup(createElement(HomeFeaturedCarousel, { products: [product, { ...product, id: "next", slug: "next", image: { url: "/uploads/products/next.webp", alt: "Outro" } }] }));
    expect(html).toContain('aria-label="Próximo produto em destaque"');
    expect(html).toContain("data-motion-control");
    expect(html).not.toContain('href="/produto/next"');
    expect(html).not.toContain("next.webp");
  });
});
