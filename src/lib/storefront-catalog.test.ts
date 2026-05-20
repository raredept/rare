import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

function product(overrides: Record<string, unknown>) {
  return {
    id: "prod-1",
    title: "Produto mock",
    slug: "produto-mock",
    priceInCents: 10000,
    category: null,
    subcategory: null,
    images: [],
    variants: [],
    ...overrides,
  };
}

describe("storefront catalog helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets active featured products through the existing featured flag", async () => {
    const featuredProduct = product({ id: "featured-1", featured: true });
    mocks.prisma.product.findMany.mockResolvedValueOnce([featuredProduct]);

    const { getFeaturedProducts } = await import("@/lib/storefront");
    const products = await getFeaturedProducts();

    expect(products).toEqual([featuredProduct]);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, featured: true }),
      }),
    );
  });

  it("gets recent products without prioritizing the featured flag", async () => {
    const recentProduct = product({ id: "recent-1", featured: false });
    mocks.prisma.product.findMany.mockResolvedValueOnce([recentProduct]);

    const { getRecentProducts } = await import("@/lib/storefront");
    const products = await getRecentProducts({ limit: 4 });

    expect(products).toEqual([recentProduct]);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
        orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }],
        take: 4,
      }),
    );
  });

  it("builds home category tiles with products first and empty categories marked as soon", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        category: { slug: "camisetas" },
        subcategory: null,
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "bags" },
      },
    ]);

    const { getHomeCategoryTiles } = await import("@/lib/storefront");
    const tiles = await getHomeCategoryTiles();

    expect(tiles.primary[0]).toMatchObject({
      name: "Camisetas",
      href: "/categoria/camisetas",
      total: 1,
      status: "available",
    });
    expect(tiles.primary[1]).toMatchObject({
      name: "Acessórios",
      href: "/categoria/acessorios",
      total: 1,
      status: "available",
    });
    expect(tiles.primary.at(-1)).toMatchObject({
      total: 0,
      status: "soon",
    });
    expect(tiles.accessories[0]).toMatchObject({
      name: "Bags",
      total: 1,
      status: "available",
    });
    expect(tiles.accessories.some((tile) => tile.name === "Relógios" && tile.status === "soon")).toBe(true);
  });

  it("groups active products by category and accessory subcategory in the public catalog order", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      product({
        id: "calca-1",
        category: { name: "Calças", slug: "calcas" },
        subcategory: null,
      }),
      product({
        id: "bag-1",
        category: { name: "Acessórios", slug: "acessorios" },
        subcategory: { name: "Bags", slug: "bags" },
      }),
      product({
        id: "camiseta-1",
        category: { name: "Camisetas", slug: "camisetas" },
        subcategory: null,
      }),
    ]);

    const { getProductsGroupedByCategory } = await import("@/lib/storefront");
    const sections = await getProductsGroupedByCategory();

    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
    expect(sections.map((section) => section.name)).toEqual(["Camisetas", "Calças", "Bags"]);
    expect(sections.map((section) => section.products.map((item) => item.id))).toEqual([["camiseta-1"], ["calca-1"], ["bag-1"]]);
  });

  it("groups a parent category page by active child categories and hides empty children", async () => {
    mocks.prisma.category.findUnique.mockResolvedValueOnce({
      id: "cat-accessories",
      name: "Acessórios",
      slug: "acessorios",
      active: true,
      children: [
        { name: "Bags", slug: "bags" },
        { name: "Bonés", slug: "bones" },
        { name: "Relógios", slug: "relogios" },
      ],
    });
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      product({
        id: "bone-1",
        category: { name: "Acessórios", slug: "acessorios" },
        subcategory: { name: "Bonés", slug: "bones" },
      }),
      product({
        id: "bag-1",
        category: { name: "Acessórios", slug: "acessorios" },
        subcategory: { name: "Bags", slug: "bags" },
      }),
    ]);

    const { getCategoryPageData } = await import("@/lib/storefront");
    const pageData = await getCategoryPageData("acessorios");

    expect(pageData?.kind).toBe("grouped");
    if (!pageData || pageData.kind !== "grouped") {
      throw new Error("Expected grouped page data");
    }
    expect(pageData.title).toBe("Acessórios");
    expect(pageData.sections.map((section) => section.name)).toEqual(["Bags", "Bonés"]);
    expect(pageData.sections.map((section) => section.products.map((item) => item.id))).toEqual([["bag-1"], ["bone-1"]]);
    expect(pageData.sections.some((section) => section.slug === "relogios")).toBe(false);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          AND: [
            {
              OR: [{ category: { slug: "acessorios" } }, { subcategory: { slug: "acessorios" } }],
            },
          ],
        }),
      }),
    );
  });

  it("hides empty grouped categories and handles an empty catalog", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([]);

    const { getProductsGroupedByCategory } = await import("@/lib/storefront");
    const sections = await getProductsGroupedByCategory();

    expect(sections).toEqual([]);
  });

  it("limits grouped sections and exposes when a category has more products", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce(
      Array.from({ length: 9 }, (_, index) =>
        product({
          id: `camiseta-${index + 1}`,
          category: { name: "Camisetas", slug: "camisetas" },
          subcategory: null,
        }),
      ),
    );

    const { getProductsGroupedByCategory } = await import("@/lib/storefront");
    const [section] = await getProductsGroupedByCategory({ limitPerCategory: 8 });

    expect(section?.name).toBe("Camisetas");
    expect(section?.total).toBe(9);
    expect(section?.products).toHaveLength(8);
    expect(section?.hasMore).toBe(true);
  });

  it("returns virtual featured page data without looking up a database category", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([product({ id: "featured-1", featured: true })]);

    const { getCategoryPageData } = await import("@/lib/storefront");
    const pageData = await getCategoryPageData("destaques");

    expect(pageData?.kind).toBe("featured");
    expect(pageData?.title).toBe("Destaques da loja");
    expect(mocks.prisma.category.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, featured: true }),
      }),
    );
  });

  it("returns virtual grouped catalog page data without looking up a database category", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([]);

    const { getCategoryPageData } = await import("@/lib/storefront");
    const pageData = await getCategoryPageData("tudo");

    expect(pageData?.kind).toBe("grouped");
    expect(pageData?.title).toBe("Catálogo completo");
    if (!pageData || pageData.kind !== "grouped") {
      throw new Error("Expected grouped page data");
    }
    expect(pageData.sections).toEqual([]);
    expect(mocks.prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it("keeps unknown real category slugs as not-found page data", async () => {
    mocks.prisma.category.findUnique.mockResolvedValueOnce(null);

    const { getCategoryPageData } = await import("@/lib/storefront");
    const pageData = await getCategoryPageData("categoria-inexistente");

    expect(pageData).toBeNull();
    expect(mocks.prisma.category.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "categoria-inexistente" } }),
    );
  });
});
