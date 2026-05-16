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
      eyebrow: "SELEÇÃO RARE",
      title: "Produtos em destaque",
      description: "Peças selecionadas em evidência na curadoria da loja.",
      products: [product],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "destaques" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("destaques", { query: undefined });
    expect(html).toContain("Produtos em destaque");
    expect(html).toContain("Peças selecionadas em evidência na curadoria da loja.");
    expect(html).toContain("Camiseta RARE");
  });

  it("renders the grouped all-products virtual category page", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "grouped",
      slug: "tudo",
      eyebrow: "CATÁLOGO RARE",
      title: "Todos os produtos",
      description: "Explore a curadoria completa por categoria.",
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
    expect(html).toContain("Todos os produtos");
    expect(html).toContain("Explore a curadoria completa por categoria.");
    expect(html).toContain("Camisetas");
    expect(html).toContain('href="/categoria/camisetas"');
    expect(html).toContain("Camiseta RARE");
  });

  it("generates basic metadata for virtual categories", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "SELEÇÃO RARE",
      title: "Produtos em destaque",
      description: "Peças selecionadas em evidência na curadoria da loja.",
      products: [product],
    });

    const result = await generateMetadata({ params: Promise.resolve({ slug: "destaques" }) });

    expect(result.title).toBe("Produtos em destaque");
    expect(result.description).toBe("Peças selecionadas em evidência na curadoria da loja.");
    expect(result.alternates).toEqual({ canonical: "/categoria/destaques" });
  });

  it("renders the featured empty state when no featured products are active", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "SELEÇÃO RARE",
      title: "Produtos em destaque",
      description: "Peças selecionadas em evidência na curadoria da loja.",
      products: [],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "destaques" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Nenhum produto em destaque no momento.");
    expect(html).toContain("Novos drops podem aparecer em breve.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain('href="/categoria/destaques"');
  });

  it("renders a useful empty state for empty real categories", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "category",
      slug: "cuecas",
      eyebrow: "Categoria",
      title: "Cuecas",
      description: "Seleção atualizada de produtos ativos nesta categoria.",
      products: [],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "cuecas" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Nenhum produto nessa categoria no momento.");
    expect(html).toContain("Novos drops podem aparecer em breve.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain("Ver catálogo completo");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Ver destaques");
  });
});
