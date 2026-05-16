import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoryPage, { generateMetadata } from "@/app/(store)/categoria/[slug]/page";

const mocks = vi.hoisted(() => ({
  getCategoryPageData: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/components/store/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => createElement("article", null, product.title),
}));

vi.mock("@/lib/storefront", () => ({
  getCategoryPageData: mocks.getCategoryPageData,
}));

const product = {
  id: "prod-1",
  title: "Camiseta RARE",
  slug: "camiseta-rare",
  priceInCents: 10000,
  category: { name: "Camisetas", slug: "camisetas" },
  subcategory: null,
  images: [],
  variants: [],
};

describe("store category page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the featured virtual category page", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      products: [product],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "destaques" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("destaques", { query: undefined });
    expect(html).toContain("Destaques da loja");
    expect(html).toContain("Peças em evidência na RARE — selecionadas por estilo, procura e presença.");
    expect(html).toContain("Camiseta RARE");
  });

  it("renders the grouped all-products virtual category page", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "grouped",
      slug: "tudo",
      eyebrow: "Catálogo RARE",
      title: "Catálogo completo",
      description: "Explore todas as peças da RARE por categoria.",
      sections: [
        {
          name: "Camisetas",
          slug: "camisetas",
          href: "/categoria/camisetas",
          products: [product],
          total: 1,
          hasMore: false,
        },
      ],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "tudo" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("tudo", { query: undefined });
    expect(html).toContain("Catálogo completo");
    expect(html).toContain("Explore todas as peças da RARE por categoria.");
    expect(html).toContain("Camisetas");
    expect(html).toContain('href="/categoria/camisetas"');
    expect(html).toContain("Camiseta RARE");
  });

  it("generates basic metadata for virtual categories", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      products: [product],
    });

    const result = await generateMetadata({ params: Promise.resolve({ slug: "destaques" }) });

    expect(result.title).toBe("Destaques da loja");
    expect(result.description).toBe("Peças em evidência na RARE — selecionadas por estilo, procura e presença.");
    expect(result.alternates).toEqual({ canonical: "/categoria/destaques" });
  });

  it("renders the featured empty state when no featured products are active", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      products: [],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "destaques" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Nenhum destaque ativo no momento.");
    expect(html).toContain("Volte em breve ou explore o catálogo completo.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).not.toContain("admin");
  });

  it("renders a useful empty state for empty real categories", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "category",
      slug: "cuecas",
      eyebrow: "Categoria",
      title: "Cuecas",
      description: "Peças disponíveis agora nesta categoria.",
      products: [],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "cuecas" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Nada por aqui no momento.");
    expect(html).toContain("Essa categoria ainda não tem peças disponíveis, mas novos drops podem aparecer a qualquer hora.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain("Ver catálogo completo");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Ver destaques da loja");
    expect(html).not.toContain("admin");
  });
});
