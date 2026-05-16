import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage, { metadata } from "@/app/(store)/page";

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getFeaturedProducts: vi.fn(),
  getRecentProducts: vi.fn(),
  getHomeCategoryTiles: vi.fn(),
}));

vi.mock("@/components/store/home-hero-carousel", () => ({
  HomeHeroCarousel: ({ slides }: { slides: { id: string }[] }) =>
    createElement("section", { "data-testid": "home-hero-carousel", "data-slide-count": String(slides.length) }, "Hero RARE"),
}));

vi.mock("@/components/store/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => createElement("article", null, product.title),
}));

vi.mock("@/lib/storefront", () => ({
  getProducts: mocks.getProducts,
  getFeaturedProducts: mocks.getFeaturedProducts,
  getRecentProducts: mocks.getRecentProducts,
  getHomeCategoryTiles: mocks.getHomeCategoryTiles,
}));

vi.mock("@/lib/home-banners", () => ({
  getHomeBannerSlidesForStore: vi.fn(async () => [
    {
      id: "dynamic-banner",
      imageUrl: "",
      alt: "Banner dinâmico",
      active: true,
    },
  ]),
}));

function product(id: string, title = `Produto ${id}`) {
  return {
    id,
    title,
    slug: id,
    priceInCents: 10000,
    category: null,
    subcategory: null,
    images: [],
    variants: [],
  };
}

describe("store home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProducts.mockResolvedValue([product("busca-1", "Resultado mock")]);
    mocks.getFeaturedProducts.mockResolvedValue([
      product("featured-1", "Destaque 1"),
      product("featured-2", "Destaque 2"),
      product("featured-3", "Destaque 3"),
      product("featured-4", "Destaque 4"),
      product("featured-5", "Destaque 5"),
      product("featured-6", "Destaque 6"),
    ]);
    mocks.getRecentProducts.mockResolvedValue([product("recent-1", "Recente 1")]);
    mocks.getHomeCategoryTiles.mockResolvedValue({
      primary: [
        {
          name: "Camisetas",
          slug: "camisetas",
          href: "/categoria/camisetas",
          description: "Bases fortes.",
          total: 2,
          status: "available",
        },
        {
          name: "Jaquetas",
          slug: "jaquetas",
          href: "/categoria/jaquetas",
          description: "Camadas.",
          total: 0,
          status: "soon",
        },
      ],
      accessories: [
        {
          name: "Bags",
          slug: "bags",
          href: "/categoria/bags",
          description: "Bags.",
          total: 1,
          status: "available",
        },
      ],
    });
  });

  it("renders the editorial home with hero, category paths, limited featured products, trust block, and catalog CTA", async () => {
    const element = await HomePage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html.indexOf('data-testid="home-hero-carousel"')).toBeGreaterThanOrEqual(0);
    expect(html).toContain('data-slide-count="1"');
    expect(html).toContain("Explore por categoria");
    expect(html).toContain("Camisetas");
    expect(html).toContain("Jaquetas");
    expect(html).toContain("Em breve");
    expect(html).toContain("Destaques da curadoria");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Destaque 1");
    expect(html).toContain("Destaque 5");
    expect(html).not.toContain("Destaque 6");
    expect(html).toContain("Compra segura");
    expect(html).toContain("Novos na curadoria");
    expect(html).toContain("Drops selecionados, estoque controlado");
    expect(html).toContain('href="/categoria/tudo"');
    expect(mocks.getFeaturedProducts).toHaveBeenCalledWith({ limit: 5 });
    expect(mocks.getRecentProducts).toHaveBeenCalledWith({ limit: 4 });
  });

  it("exports basic SEO metadata for the storefront home", () => {
    expect(metadata.title).toEqual({
      absolute: "RARE — Curadoria streetwear e importados selecionados",
    });
    expect(metadata.description).toBe("Streetwear, peças importadas e drops selecionados em uma experiência de compra direta, segura e premium.");
    expect(metadata.alternates).toEqual({ canonical: "/" });
  });

  it("keeps search pages focused on results without the hero carousel", async () => {
    const element = await HomePage({ searchParams: Promise.resolve({ q: "camiseta" }) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).not.toContain('data-testid="home-hero-carousel"');
    expect(html).toContain('Resultado para &quot;camiseta&quot;');
    expect(html).toContain("Resultado mock");
    expect(mocks.getProducts).toHaveBeenCalledWith({ query: "camiseta" });
    expect(mocks.getHomeCategoryTiles).not.toHaveBeenCalled();
  });
});
