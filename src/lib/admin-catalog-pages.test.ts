import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/app/admin/(protected)/categories/actions", () => ({
  deleteCategoryAction: "/admin/categories/delete",
  saveCategoryAction: "/admin/categories/save",
  toggleCategoryActiveAction: "/admin/categories/toggle",
}));

vi.mock("@/app/admin/(protected)/products/actions", () => ({
  deleteProductAction: "/admin/products/delete",
  toggleProductActiveAction: "/admin/products/toggle",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin catalog pages", () => {
  it("renders categories with hierarchy, status and basic counts", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      {
        id: "cat-accessories",
        name: "Acessórios",
        slug: "acessorios",
        parentId: null,
        parent: null,
        active: true,
        sortOrder: 7,
        _count: { children: 1, products: 0, subcategoryProducts: 0 },
      },
      {
        id: "cat-bags",
        name: "Bags",
        slug: "bags",
        parentId: "cat-accessories",
        parent: { id: "cat-accessories", name: "Acessórios" },
        active: true,
        sortOrder: 1,
        _count: { children: 0, products: 0, subcategoryProducts: 2 },
      },
      {
        id: "cat-cuecas",
        name: "Cuecas",
        slug: "cuecas",
        parentId: "cat-accessories",
        parent: { id: "cat-accessories", name: "Acessórios" },
        active: true,
        sortOrder: 3,
        _count: { children: 0, products: 0, subcategoryProducts: 0 },
      },
    ]);

    const { default: CategoriesPage } = await import("@/app/admin/(protected)/categories/page");
    const element = await CategoriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Categorias");
    expect(html).toContain("Acessórios");
    expect(html).toContain("Bags");
    expect(html).toContain("Cuecas");
    expect(html).toContain("Subcategoria");
    expect(html).toContain("2 produto(s)");
  }, 30000);

  it("renders products with thumbnail, category, stock and operational badges", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      { id: "cat-accessories", name: "Acessórios", parent: null },
      { id: "cat-bags", name: "Bags", parent: { id: "cat-accessories", name: "Acessórios" } },
    ]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        id: "prod-supreme-bag",
        title: "Supreme Bag",
        brand: "Supreme",
        active: true,
        featured: true,
        priceInCents: 52999,
        weightGrams: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        category: { name: "Acessórios" },
        subcategory: { name: "Bags" },
        variants: [{ stock: 1, reservedStock: 0 }],
        images: [{ url: "/uploads/products/bag-supreme.png" }],
      },
    ]);

    const { default: ProductsPage } = await import("@/app/admin/(protected)/products/page");
    const element = await ProductsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Supreme Bag");
    expect(html).toContain("Acessórios");
    expect(html).toContain("Subcategoria: Bags");
    expect(html).toContain("Destaque");
    expect(html).toContain("Estoque baixo");
    expect(html).toContain("Local");
    expect(html).toContain("Sem dados de frete");
  }, 15000);
});
