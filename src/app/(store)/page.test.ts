import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage, { metadata } from "@/app/(store)/page";
import { absoluteUrl } from "@/lib/seo";

const mocks = vi.hoisted(() => ({
  getAppUrl: vi.fn(),
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

vi.mock("@/lib/env", () => ({
  getAppUrl: mocks.getAppUrl,
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

function getJsonLdScripts(html: string) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

describe("store home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockReturnValue("https://raredept.com.br");
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

  it("renders the editorial home with hero, featured products, recent products, categories, final trust block, and catalog CTA", async () => {
    const element = await HomePage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html.indexOf('data-testid="home-hero-carousel"')).toBeGreaterThanOrEqual(0);
    expect(html).toContain('data-slide-count="1"');
    expect(html).toContain("Escolha por categoria");
    expect(html).toContain("Camisetas");
    expect(html).toContain("Bags");
    expect(html).not.toContain("Jaquetas");
    expect(html).not.toContain("Em breve");
    expect(html).toContain("Destaques do mês");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Destaque 1");
    expect(html).toContain("Destaque 5");
    expect(html).not.toContain("Destaque 6");
    expect(html).toContain("Compra segura");
    expect(html).toContain("Pix e cartão");
    expect(html).toContain("Envio para todo o Brasil");
    expect(html).toContain("Peças escolhidas a dedo");
    expect(html).toContain("Atendimento direto");
    expect(html).toContain("Trocas e devoluções");
    expect(html).toContain("Chegou agora");
    expect(html).toContain("Estoque limitado. Escolha sem pressa, mas não deixa passar.");
    expect(html).not.toContain("A home aponta");
    expect(html).not.toContain("experiência de compra limpa");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html.indexOf("Destaques do mês")).toBeLessThan(html.indexOf("Chegou agora"));
    expect(html.indexOf("Chegou agora")).toBeLessThan(html.indexOf("Escolha por categoria"));
    expect(html.indexOf("Escolha por categoria")).toBeLessThan(html.indexOf("Compra segura"));
    expect(mocks.getFeaturedProducts).toHaveBeenCalledWith({ limit: 5 });
    expect(mocks.getRecentProducts).toHaveBeenCalledWith({ limit: 4 });
  });

  it("renders public Organization JSON-LD on the storefront home", async () => {
    const element = await HomePage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);
    const schemas = getJsonLdScripts(html);
    const organizationSchemas = schemas.filter((schema) => schema["@type"] === "Organization");

    expect(organizationSchemas).toHaveLength(1);
    expect(organizationSchemas[0]).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "RARE",
      url: "https://raredept.com.br",
      logo: "https://raredept.com.br/brand/rare-logo.png",
    });
    expect(JSON.stringify(organizationSchemas[0])).not.toContain("suporte@");
    expect(JSON.stringify(organizationSchemas[0])).not.toContain("contato@");
    expect(JSON.stringify(organizationSchemas[0])).not.toContain("admin");
    expect(JSON.stringify(organizationSchemas[0])).not.toContain("token");
    expect(JSON.stringify(organizationSchemas[0])).not.toContain("secret");
  });

  it("exports basic SEO metadata for the storefront home", () => {
    const canonical = absoluteUrl("/");

    expect(metadata.title).toEqual({
      absolute: "RARE — Streetwear importado e drops selecionados",
    });
    expect(metadata.description).toBe("Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.");
    expect(metadata.alternates).toEqual({ canonical });
    expect(metadata.openGraph).toMatchObject({
      title: "RARE — Streetwear importado e drops selecionados",
      description: "Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.",
      url: canonical,
      siteName: "RARE",
      locale: "pt_BR",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "RARE — Streetwear importado e drops selecionados",
      description: "Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.",
    });
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
