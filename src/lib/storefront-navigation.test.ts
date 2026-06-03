import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

describe("storefront navigation categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders accessories dropdown children with the expected public sequence", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      {
        id: "cat-accessories",
        name: "Acessórios",
        slug: "acessorios",
        sortOrder: 7,
        children: [
          { id: "cat-relogios", name: "Relógios", slug: "relogios", sortOrder: 30 },
          { id: "cat-cuecas", name: "Cuecas", slug: "cuecas", sortOrder: 30 },
          { id: "cat-bags", name: "Bags", slug: "bags", sortOrder: 30 },
          { id: "cat-oculos", name: "Óculos", slug: "oculos", sortOrder: 30 },
          { id: "cat-bones", name: "Bonés", slug: "bones", sortOrder: 30 },
          { id: "cat-meias", name: "Meias", slug: "meias", sortOrder: 30 },
        ],
      },
    ]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "relogios" },
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "cuecas" },
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "bags" },
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "oculos" },
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "bones" },
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "meias" },
        variants: [{ active: true, stock: 2, reservedStock: 0 }],
      },
    ]);

    const { getNavigationCategories } = await import("@/lib/storefront");
    const categories = await getNavigationCategories();

    expect(categories[0]?.children.map((category) => category.name)).toEqual([
      "Bags",
      "Bonés",
      "Cuecas",
      "Meias",
      "Óculos",
      "Relógios",
    ]);
  }, 60000);

  it("hides empty and unavailable categories from public navigation while keeping available categories", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      { id: "cat-camisetas", name: "Camisetas", slug: "camisetas", sortOrder: 10, children: [] },
      { id: "cat-bermudas", name: "Bermudas", slug: "bermudas", sortOrder: 40, children: [] },
      {
        id: "cat-accessories",
        name: "Acessórios",
        slug: "acessorios",
        sortOrder: 90,
        children: [
          { id: "cat-bags", name: "Bags", slug: "bags", sortOrder: 10 },
          { id: "cat-meias", name: "Meias", slug: "meias", sortOrder: 20 },
          { id: "cat-relogios", name: "Relógios", slug: "relogios", sortOrder: 30 },
        ],
      },
    ]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        category: { slug: "camisetas" },
        subcategory: null,
        variants: [{ active: true, stock: 3, reservedStock: 1 }],
      },
      {
        category: { slug: "bermudas" },
        subcategory: null,
        variants: [{ active: true, stock: 1, reservedStock: 1 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "bags" },
        variants: [{ active: true, stock: 1, reservedStock: 0 }],
      },
      {
        category: { slug: "acessorios" },
        subcategory: { slug: "meias" },
        variants: [{ active: false, stock: 5, reservedStock: 0 }],
      },
    ]);

    const { getNavigationCategories } = await import("@/lib/storefront");
    const categories = await getNavigationCategories();

    expect(categories.map((category) => category.slug)).toEqual(["camisetas", "acessorios"]);
    expect(categories.find((category) => category.slug === "acessorios")?.children.map((child) => child.slug)).toEqual(["bags"]);
    expect(categories.some((category) => category.slug === "bermudas")).toBe(false);
    expect(mocks.prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, parentId: null },
      }),
    );
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });
});
