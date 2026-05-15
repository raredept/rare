import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/(store)/page";

vi.mock("@/components/store/home-hero-carousel", () => ({
  HomeHeroCarousel: ({ slides }: { slides: { id: string }[] }) =>
    createElement("section", { "data-testid": "home-hero-carousel", "data-slide-count": String(slides.length) }, "Hero RARE"),
}));

vi.mock("@/components/store/product-card", () => ({
  ProductCard: () => createElement("article", null, "Produto mock"),
}));

vi.mock("@/lib/storefront", () => ({
  getProducts: vi.fn(async () => [
    {
      id: "prod-1",
      title: "Produto mock",
      slug: "produto-mock",
      priceInCents: 10000,
      category: null,
      subcategory: null,
      images: [],
      variants: [],
    },
  ]),
}));

vi.mock("@/lib/home-banners", () => ({
  getHomeBannerSlidesForStore: vi.fn(async () => [
    {
      id: "dynamic-banner",
      imageUrl: "",
      alt: "Banner dinamico",
      active: true,
    },
  ]),
}));

describe("store home page", () => {
  it("renders the hero carousel before featured products on the default home", async () => {
    const element = await HomePage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html.indexOf('data-testid="home-hero-carousel"')).toBeGreaterThanOrEqual(0);
    expect(html).toContain('data-slide-count="1"');
    expect(html.indexOf('data-testid="home-hero-carousel"')).toBeLessThan(html.indexOf("Produtos em destaque"));
    expect(html).toContain("Produto mock");
  });

  it("keeps search pages focused on results without the hero carousel", async () => {
    const element = await HomePage({ searchParams: Promise.resolve({ q: "camiseta" }) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).not.toContain('data-testid="home-hero-carousel"');
    expect(html).toContain('Resultado para &quot;camiseta&quot;');
    expect(html).toContain("Produto mock");
  });
});
