import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    productVariant: { fields: { reservedStock: "reservedStock-field" } },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

function availableWhere(where: Record<string, unknown>) {
  return expect.objectContaining({ AND: expect.arrayContaining([expect.objectContaining(where)]) });
}

function product(overrides: Record<string, unknown>) {
  return {
    id: "prod-1",
    title: "Produto mock",
    slug: "produto-mock",
    priceInCents: 10000,
    active: true,
    featured: false,
    featuredSortOrder: null,
    category: null,
    subcategory: null,
    images: [],
    variants: [],
    ...overrides,
  };
}

describe("storefront catalog helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback: (client: typeof mocks.prisma) => Promise<unknown>) => callback(mocks.prisma));
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.product.count.mockResolvedValue(0);
  });

  it("gets active featured products through the existing featured flag", async () => {
    const featuredProduct = product({ id: "featured-1", featured: true });
    mocks.prisma.product.findMany.mockResolvedValueOnce([featuredProduct]);

    const { getFeaturedProducts } = await import("@/lib/storefront");
    const products = await getFeaturedProducts();

    expect(products).toEqual([featuredProduct]);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: availableWhere({ active: true, featured: true }),
        orderBy: [
          { featuredSortOrder: { sort: "asc", nulls: "last" } },
          { updatedAt: "desc" },
          { title: "asc" },
          { id: "asc" },
        ],
      }),
    );
  });

  it("asks Prisma to put manually ordered featured products before unordered featured products", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      product({ id: "featured-ordered", featured: true, featuredSortOrder: 1 }),
      product({ id: "featured-unordered", featured: true, featuredSortOrder: null }),
    ]);

    const { getFeaturedProducts } = await import("@/lib/storefront");
    const products = await getFeaturedProducts({ limit: 5 });

    expect(products.map((item) => item.id)).toEqual(["featured-ordered", "featured-unordered"]);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: availableWhere({ active: true, featured: true }),
        orderBy: [
          { featuredSortOrder: { sort: "asc", nulls: "last" } },
          { updatedAt: "desc" },
          { title: "asc" },
          { id: "asc" },
        ],
        take: 5,
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
        where: availableWhere({ active: true }),
        orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        take: 4,
      }),
    );
  });

  it("builds home category tiles only for categories with purchasable products", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        category: { slug: "camisetas" },
        subcategory: null,
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "bags" },
        variants: [{ active: true, stock: 1, reservedStock: 0 }],
      },
      {
        category: { slug: "bermudas" },
        subcategory: null,
        variants: [{ active: true, stock: 1, reservedStock: 1 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "relogios" },
        variants: [{ active: false, stock: 5, reservedStock: 0 }],
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
    expect(tiles.primary.map((tile) => tile.slug)).toEqual(["camisetas", "acessorios"]);
    expect(tiles.accessories[0]).toMatchObject({
      name: "Bags",
      total: 1,
      status: "available",
    });
    expect(tiles.accessories.map((tile) => tile.slug)).toEqual(["bags"]);
    expect(tiles.primary.some((tile) => tile.slug === "bermudas")).toBe(false);
    expect(tiles.accessories.some((tile) => tile.slug === "relogios")).toBe(false);
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
        where: availableWhere({ active: true }),
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
        where: availableWhere({
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

  it("lists every active product in the complete catalog, whatever its category", async () => {
    // Staging regression: every product sat in a category outside the old
    // hardcoded list, and "Catálogo completo" said the catalog was empty.
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      product({ id: "hml-1", category: { name: "Homologação", slug: "homologacao", active: true, sortOrder: 9 } }),
      product({ id: "moletom-1", category: { name: "Moletons", slug: "moletons", active: true, sortOrder: 6 } }),
      product({ id: "camiseta-1", category: { name: "Camisetas", slug: "camisetas", active: true, sortOrder: 1 } }),
      product({
        id: "bone-1",
        category: { name: "Acessórios", slug: "acessorios", active: true, sortOrder: 7 },
        subcategory: { name: "Bonés", slug: "bones", active: true, sortOrder: 2 },
      }),
      product({ id: "acessorio-1", category: { name: "Acessórios", slug: "acessorios", active: true, sortOrder: 7 } }),
    ]);

    const { getProductsGroupedByCategory } = await import("@/lib/storefront");
    const sections = await getProductsGroupedByCategory({ limitPerCategory: 10 });

    expect(sections.flatMap((section) => section.products.map((item) => item.id)).sort()).toEqual(
      ["acessorio-1", "bone-1", "camiseta-1", "hml-1", "moletom-1"],
    );
    // Preferred order first; categories outside it next, by their sort order;
    // Acessórios last, its own products before its subcategories.
    expect(sections.map((section) => section.slug)).toEqual(["camisetas", "moletons", "homologacao", "acessorios", "bones"]);
    expect(sections.every((section) => section.href?.startsWith(`/categoria/${section.slug}`))).toBe(true);
  });

  it("never links a section to an inactive category, and keeps its products reachable", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      product({
        id: "sub-inativa",
        category: { name: "Acessórios", slug: "acessorios", active: true },
        subcategory: { name: "Meias", slug: "meias", active: false },
      }),
      ...Array.from({ length: 12 }, (_, index) =>
        product({ id: `orfao-${index}`, category: { name: "Antiga", slug: "antiga", active: false } }),
      ),
      product({ id: "sem-categoria", category: null }),
    ]);

    const { getProductsGroupedByCategory } = await import("@/lib/storefront");
    const sections = await getProductsGroupedByCategory({ limitPerCategory: 10 });

    expect(sections.map((section) => [section.slug, section.href])).toEqual([
      ["acessorios", "/categoria/acessorios"],
      ["outras-pecas", null],
    ]);
    const catchAll = sections[1];
    expect(catchAll.total).toBe(13);
    expect(catchAll.products).toHaveLength(13);
    expect(catchAll.hasMore).toBe(false);
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
        where: availableWhere({ active: true, featured: true }),
      }),
    );
  });

  it("checks product page slug availability with an active-product lookup", async () => {
    mocks.prisma.product.findFirst.mockResolvedValueOnce({ id: "prod-1" });

    const { isProductPageSlugAvailable } = await import("@/lib/storefront");
    const isAvailable = await isProductPageSlugAvailable("camiseta-rare");

    expect(isAvailable).toBe(true);
    expect(mocks.prisma.product.findFirst).toHaveBeenCalledWith({
      where: { slug: "camiseta-rare", active: true },
      select: { id: true },
    });
  });

  it("treats missing product page slugs as unavailable", async () => {
    mocks.prisma.product.findFirst.mockResolvedValueOnce(null);

    const { isProductPageSlugAvailable } = await import("@/lib/storefront");
    const isAvailable = await isProductPageSlugAvailable("nao-existe");

    expect(isAvailable).toBe(false);
  });

  it("checks category page slug availability without loading page products", async () => {
    mocks.prisma.category.findUnique.mockResolvedValueOnce({ active: true });

    const { isCategoryPageSlugAvailable } = await import("@/lib/storefront");
    const isAvailable = await isCategoryPageSlugAvailable("camisetas");

    expect(isAvailable).toBe(true);
    expect(mocks.prisma.category.findUnique).toHaveBeenCalledWith({
      where: { slug: "camisetas" },
      select: { active: true },
    });
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("treats virtual category page slugs as available without a database lookup", async () => {
    const { isCategoryPageSlugAvailable } = await import("@/lib/storefront");

    await expect(isCategoryPageSlugAvailable("tudo")).resolves.toBe(true);
    await expect(isCategoryPageSlugAvailable("destaques")).resolves.toBe(true);
    expect(mocks.prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it("treats missing and inactive category page slugs as unavailable", async () => {
    mocks.prisma.category.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ active: false });

    const { isCategoryPageSlugAvailable } = await import("@/lib/storefront");

    await expect(isCategoryPageSlugAvailable("nao-existe")).resolves.toBe(false);
    await expect(isCategoryPageSlugAvailable("inativa")).resolves.toBe(false);
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

  it("limits the virtual grouped catalog page to 10 products per category while keeping total count", async () => {
    mocks.prisma.product.findMany.mockResolvedValueOnce(
      Array.from({ length: 11 }, (_, index) =>
        product({
          id: `camiseta-${index + 1}`,
          category: { name: "Camisetas", slug: "camisetas" },
          subcategory: null,
        }),
      ),
    );

    const { getCategoryPageData } = await import("@/lib/storefront");
    const pageData = await getCategoryPageData("tudo");

    if (!pageData || pageData.kind !== "grouped") {
      throw new Error("Expected grouped page data");
    }

    expect(pageData.sections[0]?.products).toHaveLength(10);
    expect(pageData.sections[0]?.total).toBe(11);
    expect(pageData.sections[0]?.hasMore).toBe(true);
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

  it("fills a page crossing availability groups using the remaining sold-out offset in one snapshot", async () => {
    mocks.prisma.product.count.mockResolvedValueOnce(25);
    mocks.prisma.product.findMany.mockResolvedValueOnce([product({ id: "available-last" })]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([product({ id: "sold-first" }), product({ id: "sold-second" })]);
    const { getProducts } = await import("@/lib/storefront");
    const rows = await getProducts({ offset: 24, limit: 3, query: "Rare", brand: "STÜSSY" });
    expect(rows.map((row) => row.id)).toEqual(["available-last", "sold-first", "sold-second"]);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
    expect(mocks.prisma.product.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 24, take: 3 }));
    expect(mocks.prisma.product.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      skip: 0, take: 2, where: { AND: [expect.objectContaining({ active: true, brand: { equals: "STÜSSY", mode: "insensitive" } }),
        { variants: { none: { active: true, stock: { gt: "reservedStock-field" } } } }] },
    }));
  });

  it("skips within the sold-out group after all available products and preserves a stable tie breaker", async () => {
    mocks.prisma.product.count.mockResolvedValueOnce(25);
    mocks.prisma.product.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([product({ id: "sold-later" })]);
    const { getProducts } = await import("@/lib/storefront");
    await getProducts({ offset: 48, limit: 24, orderBy: [{ priceInCents: "asc" }] });
    expect(mocks.prisma.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 23, take: 24,
      orderBy: [{ priceInCents: "asc" }, { id: "asc" }],
    }));
  });

  it("returns a 24-product leaf page with a lookahead and keeps the same search and brand filters", async () => {
    mocks.prisma.category.findUnique.mockResolvedValueOnce({ name: "Camisetas", slug: "camisetas", active: true, children: [] });
    mocks.prisma.product.count.mockResolvedValueOnce(60);
    mocks.prisma.product.findMany.mockResolvedValueOnce(Array.from({ length: 25 }, (_, index) => product({ id: `page-${index}` })));
    const { getCategoryPageData } = await import("@/lib/storefront");
    const data = await getCategoryPageData("camisetas", { page: 2, query: "Rare", brand: "BAPE" });
    expect(data).toMatchObject({ page: 2, hasMore: true });
    if (data?.kind !== "category") throw new Error("Expected leaf page");
    expect(data.products).toHaveLength(24);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 24, take: 25,
      where: availableWhere({ active: true, brand: { equals: "BAPE", mode: "insensitive" } }),
    }));
  });
});
