import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CategoryPage, { generateMetadata } from "@/app/(store)/categoria/[slug]/page";
import { absoluteUrl } from "@/lib/seo";

const mocks = vi.hoisted(() => ({
  getAppUrl: vi.fn(),
  getCategoryPageData: vi.fn(),
  getNavigationCategories: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/store/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => createElement("article", null, product.title),
}));

vi.mock("@/lib/env", () => ({
  getAppUrl: mocks.getAppUrl,
  isCheckoutEnabled: () => true,
}));

vi.mock("@/lib/storefront", () => ({
  getCategoryPageData: mocks.getCategoryPageData,
  getCategoryTagline: (slug: string) => (slug === "camisetas" ? "Bases fortes para o dia a dia." : null),
  getNavigationCategories: mocks.getNavigationCategories,
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

function getJsonLdScripts(html: string) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

describe("store category page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("APP_URL", "https://raredept.com.br");
    mocks.getAppUrl.mockReturnValue("https://raredept.com.br");
    mocks.getNavigationCategories.mockResolvedValue([]);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("renders the featured virtual category page", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      page: 1, hasMore: false,
      products: [product],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "destaques" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("destaques", { query: undefined, brand: undefined, page: 1 }, expect.objectContaining({ sort: "relevance" }));
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

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("tudo", { query: undefined, brand: undefined, page: 1 }, expect.objectContaining({ sort: "relevance" }));
    expect(html).toContain("Catálogo completo");
    expect(html).toContain("Explore todas as peças da RARE por categoria.");
    expect(html).toContain("Camisetas");
    expect(html).toContain('href="/categoria/camisetas"');
    expect(html).toContain("Camiseta RARE");
  });

  it("renders the catch-all section of the complete catalog without a category link", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "grouped",
      slug: "tudo",
      eyebrow: "Catálogo RARE",
      title: "Catálogo completo",
      description: "Explore todas as peças da RARE por categoria.",
      sections: [{ name: "Outras peças", slug: "outras-pecas", href: null, products: [product], total: 1, hasMore: false }],
    });

    const element = await CategoryPage({ params: Promise.resolve({ slug: "tudo" }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Outras peças");
    expect(html).toContain("Camiseta RARE");
    expect(html).not.toContain("/categoria/outras-pecas");
  });

  it("renders grouped sections for a real parent category page", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "grouped",
      slug: "acessorios",
      eyebrow: "Categoria",
      title: "Acessórios",
      description: "Peças disponíveis agora nesta categoria, separadas por seção.",
      sections: [
        {
          name: "Bags",
          slug: "bags",
          href: "/categoria/bags",
          products: [{ ...product, id: "bag-1", title: "Supreme Bag" }],
          total: 1,
          hasMore: false,
        },
        {
          name: "Bonés",
          slug: "bones",
          href: "/categoria/bones",
          products: [{ ...product, id: "bone-1", title: "Boné Supreme" }],
          total: 1,
          hasMore: false,
        },
      ],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "acessorios" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Acessórios");
    expect(html).toContain("Bags");
    expect(html).toContain("Bonés");
    expect(html).toContain("Supreme Bag");
    expect(html).toContain("Boné Supreme");
    expect(html).toContain('href="/categoria/bags"');
    expect(html).toContain('href="/categoria/bones"');
  });

  it("generates basic metadata for virtual categories", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      page: 1, hasMore: false,
      products: [product],
    });

    const result = await generateMetadata({ params: Promise.resolve({ slug: "destaques" }) });
    const canonical = absoluteUrl("/categoria/destaques");

    expect(result.title).toBe("Destaques da loja");
    expect(result.description).toBe("Peças em evidência na RARE — selecionadas por estilo, procura e presença.");
    expect(result.alternates).toEqual({ canonical });
    expect(result.openGraph).toMatchObject({
      title: "Destaques da loja | RARE",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      url: canonical,
      siteName: "RARE",
      locale: "pt_BR",
      type: "website",
    });
    expect(result.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Destaques da loja | RARE",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
    });
  });

  it("generates metadata for the all-products virtual category", async () => {
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

    const result = await generateMetadata({ params: Promise.resolve({ slug: "tudo" }) });
    const canonical = absoluteUrl("/categoria/tudo");

    expect(result.title).toBe("Catálogo completo");
    expect(result.description).toBe("Explore todas as peças da RARE por categoria.");
    expect(result.alternates).toEqual({ canonical });
    expect(result.robots).toBeUndefined();
    expect(result.openGraph).toMatchObject({
      title: "Catálogo completo | RARE",
      url: canonical,
      type: "website",
    });
  });

  it("marks existing empty categories as noindex in metadata", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "category",
      slug: "cuecas",
      eyebrow: "Categoria",
      title: "Cuecas",
      description: "Peças disponíveis agora nesta categoria.",
      page: 1, hasMore: false,
      products: [],
    });

    const result = await generateMetadata({ params: Promise.resolve({ slug: "cuecas" }) });

    expect(result.alternates).toEqual({ canonical: absoluteUrl("/categoria/cuecas") });
    expect(result.robots).toEqual({ index: false, follow: true });
  });

  it("canonicalizes page 2 to itself and filtered views to the clean category (RARE-SEO-GOOGLE-01)", async () => {
    const camisetas = { kind: "category", slug: "camisetas", eyebrow: "Categoria", title: "Camisetas", description: "Peças selecionadas pela RARE nesta categoria.", page: 1, hasMore: true, products: [product] };
    mocks.getCategoryPageData.mockResolvedValue(camisetas);

    const page2 = await generateMetadata({ params: Promise.resolve({ slug: "camisetas" }), searchParams: Promise.resolve({ page: "2" }) });
    expect(page2.alternates).toEqual({ canonical: `${absoluteUrl("/categoria/camisetas")}?page=2` });
    expect(page2.title).toBe("Camisetas — página 2");
    expect(page2.description).toContain("Camisetas na RARE. Bases fortes para o dia a dia.");

    for (const search of [{ brand: "Supreme" }, { sort: "price-asc" }, { size: "M", page: "2" }, { q: "bape" }, { price: "100-200" }, { available: "1" }, { promo: "1" }]) {
      const filtered = await generateMetadata({ params: Promise.resolve({ slug: "camisetas" }), searchParams: Promise.resolve(search) });
      expect(filtered.alternates, JSON.stringify(search)).toEqual({ canonical: absoluteUrl("/categoria/camisetas") });
      expect(filtered.robots, JSON.stringify(search)).toMatchObject({ index: false });
    }
    // Metadata always reads the unfiltered first page (the URL only decides canonical/robots).
    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("camisetas");
    mocks.getCategoryPageData.mockReset();
  });

  it("calls notFound while generating metadata for unknown categories", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce(null);

    await expect(generateMetadata({ params: Promise.resolve({ slug: "nao-existe" }) })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("nao-existe");
  });

  it("calls notFound when the category slug does not exist", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce(null);

    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: "nao-existe" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("nao-existe", { query: undefined, brand: undefined, page: 1 }, expect.objectContaining({ sort: "relevance" }));
  });

  it("renders the featured empty state when no featured products are active", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "featured",
      slug: "destaques",
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      page: 1, hasMore: false,
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
      page: 1, hasMore: false,
      products: [],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "cuecas" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Nada por aqui no momento.");
    expect(html).toContain("Essa categoria ainda não tem peças publicadas, mas novos drops podem aparecer a qualquer hora.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain("Ver catálogo completo");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Ver destaques da loja");
    expect(html).not.toContain("admin");
  });

  it("renders BreadcrumbList JSON-LD for category pages", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({
      kind: "category",
      slug: "camisetas",
      eyebrow: "Categoria",
      title: "Camisetas",
      description: "Peças disponíveis agora nesta categoria.",
      page: 1, hasMore: false,
      products: [product],
    });

    const element = await CategoryPage({
      params: Promise.resolve({ slug: "camisetas" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as ReactElement);
    const schemas = getJsonLdScripts(html);
    const breadcrumbSchemas = schemas.filter((schema) => schema["@type"] === "BreadcrumbList");

    expect(breadcrumbSchemas).toHaveLength(1);
    expect(breadcrumbSchemas[0].itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Início", item: "https://raredept.com.br/" },
      { "@type": "ListItem", position: 2, name: "Camisetas", item: "https://raredept.com.br/categoria/camisetas" },
    ]);
  });

  it("renders previous and next page links that preserve the search and brand", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({ kind: "category", slug: "camisetas", eyebrow: "Categoria", title: "Camisetas",
      description: "Peças selecionadas", products: [product], page: 2, hasMore: true });
    const element = await CategoryPage({ params: Promise.resolve({ slug: "camisetas" }), searchParams: Promise.resolve({ q: "Rare +", brand: "STÜSSY", page: "2" }) });
    const html = renderToStaticMarkup(element);
    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("camisetas", { query: "Rare +", brand: "STÜSSY", page: 2 }, expect.objectContaining({ sort: "relevance" }));
    expect(html).toContain('aria-label="Paginação do catálogo"');
    const links = html.match(/<a\b[^>]*>/g) ?? [];
    expect(links.find((link) => link.includes('rel="prev"'))).toContain('href="/categoria/camisetas?q=Rare+%2B&amp;brand=ST%C3%9CSSY"');
    expect(links.find((link) => link.includes('rel="next"'))).toContain('href="/categoria/camisetas?q=Rare+%2B&amp;brand=ST%C3%9CSSY&amp;page=3"');
    expect(html).toContain("Página 2");
  });

  it("offers a first-page recovery for an empty later page without discarding filters", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({ kind: "featured", slug: "destaques", eyebrow: "Destaques", title: "Destaques da loja",
      description: "Seleção", products: [], page: 9, hasMore: false });
    const html = renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ slug: "destaques" }), searchParams: Promise.resolve({ q: "Drop", brand: "BAPE", page: "9" }) }));
    expect(html).toContain("Nenhum produto nesta página.");
    expect(html).toContain('href="/categoria/destaques?q=Drop&amp;brand=BAPE"');
    expect(html).not.toContain('rel="next"');
    expect(html).not.toContain("Nenhum destaque ativo");
  });
});

describe("catalog shortcut bar (regression: hardcoded slugs returned 404)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockReturnValue("https://raredept.com.br");
    mocks.getCategoryPageData.mockResolvedValue({
      kind: "flat",
      title: "Tudo",
      eyebrow: "Catálogo",
      description: "Todas as peças",
      products: [product],
      page: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  async function shortcutHrefs(navigable: Array<{ id: string; name: string; slug: string; children: unknown[] }>) {
    mocks.getNavigationCategories.mockResolvedValue(navigable);
    const element = await CategoryPage({ params: Promise.resolve({ slug: "tudo" }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);
    const bar = html.slice(html.indexOf('aria-label="Atalhos do catálogo"'));
    const barHtml = bar.slice(0, bar.indexOf("</div>"));
    return [...barHtml.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  }

  it("never links a category the store cannot serve", async () => {
    // Staging had no camisetas/jaquetas/acessorios; the old bar linked them anyway.
    const hrefs = await shortcutHrefs([{ id: "c1", name: "Homologação", slug: "homologacao", children: [] }]);
    expect(hrefs).toEqual(["/categoria/tudo", "/categoria/destaques", "/categoria/homologacao"]);
    for (const missing of ["/categoria/camisetas", "/categoria/jaquetas", "/categoria/acessorios"]) {
      expect(hrefs).not.toContain(missing);
    }
  });

  it("links the real categories in the same order as the header", async () => {
    const hrefs = await shortcutHrefs([
      { id: "a", name: "Acessórios", slug: "acessorios", children: [] },
      { id: "j", name: "Jaquetas", slug: "jaquetas", children: [] },
      { id: "c", name: "Camisetas", slug: "camisetas", children: [] },
    ]);
    expect(hrefs).toEqual(["/categoria/tudo", "/categoria/destaques", "/categoria/camisetas", "/categoria/jaquetas", "/categoria/acessorios"]);
  });

  it("keeps the virtual collections even with no categories at all", async () => {
    expect(await shortcutHrefs([])).toEqual(["/categoria/tudo", "/categoria/destaques"]);
  });

  it("marks the current collection for assistive technology", async () => {
    mocks.getNavigationCategories.mockResolvedValue([]);
    const element = await CategoryPage({ params: Promise.resolve({ slug: "tudo" }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);
    expect(html).toMatch(/href="\/categoria\/tudo" aria-current="page"/);
  });
});

describe("catalog toolbar, filters and chips (UIUX-CATALOG-001 / UIUX-NAV-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockReturnValue("https://raredept.com.br");
    mocks.getNavigationCategories.mockResolvedValue([]);
  });

  it("shows the real total, the filter button, removable chips and keeps the refinements across pages", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({ kind: "filtered", slug: "tudo", eyebrow: "Catálogo RARE", title: "Catálogo completo", description: "Tudo",
      products: [product], page: 1, hasMore: true, total: 32,
      facets: { brands: [{ value: "BAPE", label: "BAPE", count: 4 }], sizes: [{ value: "G", label: "G", count: 3 }], prices: [], availableCount: 30, promoCount: 0 } });
    const html = renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ slug: "tudo" }), searchParams: Promise.resolve({ brand: "BAPE", size: "g", sort: "price-asc" }) }) as ReactElement);
    expect(mocks.getCategoryPageData).toHaveBeenCalledWith("tudo", { query: undefined, brand: "BAPE", page: 1 }, expect.objectContaining({ size: "G", sort: "price-asc" }));
    expect(html).toContain("32 produtos");
    expect(html).not.toContain("nesta página");
    expect(html).toContain("Filtrar");
    expect(html).toMatch(/href="\/categoria\/tudo\?size=G&amp;sort=price-asc"[^>]*aria-label="Remover filtro Marca: BAPE"/);
    expect(html).toMatch(/href="\/categoria\/tudo\?brand=BAPE&amp;sort=price-asc"[^>]*aria-label="Remover filtro Tamanho: G"/);
    expect(html).toMatch(/href="\/categoria\/tudo\?brand=BAPE&amp;size=G&amp;sort=price-asc&amp;page=2" rel="next"/);
  });

  it("keeps the quick category bar only below 1024 px, where the header has none", async () => {
    mocks.getCategoryPageData.mockResolvedValueOnce({ kind: "category", slug: "camisetas", eyebrow: "Categoria", title: "Camisetas", description: "x", products: [product], page: 1, hasMore: false, total: 1 });
    const html = renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ slug: "camisetas" }), searchParams: Promise.resolve({}) }) as ReactElement);
    expect(html).toMatch(/class="[^"]*lg:hidden[^"]*" aria-label="Atalhos do catálogo"/);
  });
});
