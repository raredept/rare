import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/auth";

// Every Admin page checks the session itself; the page logic is what is under test here.
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })) }));

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findMany: vi.fn(),
    },
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
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

/** The stock snapshot is the only raw query that aggregates variants as JSON; every other one is a count. */
function mockStockSnapshots(rows: unknown[]) {
  mocks.prisma.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
    Array.isArray(strings) && strings.join("").includes("json_agg") ? rows : [{ count: 0 }],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.category.findMany.mockReset();
  mocks.prisma.product.findMany.mockReset();
  mocks.prisma.product.count.mockResolvedValue(0);
  mocks.prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);
});

describe("admin catalog pages", () => {
  it("authorizes before loading product data or summaries", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Unauthorized"));
    const { default: ProductsPage } = await import("@/app/admin/(protected)/products/page");
    await expect(ProductsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Unauthorized");
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("ignores repeated product text and category filters without crashing", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([]);
    const { default: ProductsPage } = await import("@/app/admin/(protected)/products/page");
    await ProductsPage({ searchParams: Promise.resolve({ q: ["a", "b"], category: ["a", "b"] }) });
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

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
      { id: "cat-camisetas", name: "Camisetas", parent: null },
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
        featuredSortOrder: 1,
        priceInCents: 52999,
        weightGrams: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        category: { name: "Acessórios" },
        subcategory: { name: "Bags" },
        stockPolicy: "STANDARD",
        variants: [{ stock: 1, reservedStock: 0 }],
        images: [{ url: "/uploads/products/bag-supreme.png" }],
      },
    ]);
    mockStockSnapshots([{ productId: "prod-supreme-bag", title: "Supreme Bag", active: true, stockPolicy: "STANDARD", variants: [{ active: true, stock: 1, reservedStock: 0 }], soldUnits: 0, openReservedUnits: 0, openReservationOrders: 0 }]);

    const { default: ProductsPage } = await import("@/app/admin/(protected)/products/page");
    const element = await ProductsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Supreme Bag");
    expect(html).toContain("Acessórios");
    expect(html).toContain("Subcategoria: Bags");
    expect(html).toContain("Destaque");
    expect(html).toContain("Ordem destaque: 1");
    // A replenishable item down to its last unit is critical...
    expect(html).toContain(">Reposição<");
    expect(html).toContain(">Estoque crítico<");
    expect(html).toContain("Política: Padrão");
    expect(html).toContain("Local");
    expect(html).toContain("Sem dados de frete");
    expect(html.indexOf('<option value="cat-accessories">Acessórios</option>')).toBeLessThan(
      html.indexOf('<option value="cat-bags">Acessórios / Bags</option>'),
    );
    expect(html.indexOf('<option value="cat-bags">Acessórios / Bags</option>')).toBeLessThan(
      html.indexOf('<option value="cat-camisetas">Camisetas</option>'),
    );
  }, 30000);

  it.each([
    ["available with its single unit", { variants: [{ active: true, stock: 1, reservedStock: 0 }], soldUnits: 0, openReservedUnits: 0, openReservationOrders: 0 }, ">Disponível<"],
    ["reserved by an open checkout", { variants: [{ active: true, stock: 1, reservedStock: 1 }], soldUnits: 0, openReservedUnits: 1, openReservationOrders: 1 }, ">Reservada<"],
    ["sold", { variants: [{ active: true, stock: 0, reservedStock: 0 }], soldUnits: 1, openReservedUnits: 0, openReservationOrders: 0 }, ">Vendida<"],
  ] as const)("never shows a one-of-a-kind piece as low or critical: %s", async (_name, stock, expectedBadge) => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        id: "prod-unique", title: "Jaqueta Única", brand: "RARE", active: true, featured: false, featuredSortOrder: null, priceInCents: 90000,
        weightGrams: 500, lengthCm: 30, widthCm: 30, heightCm: 5, category: null, subcategory: null, stockPolicy: "UNIQUE",
        variants: stock.variants.map(({ stock: units, reservedStock }) => ({ stock: units, reservedStock })),
        images: [{ url: "/uploads/products/jaqueta.png" }],
      },
    ]);
    mockStockSnapshots([{ productId: "prod-unique", title: "Jaqueta Única", active: true, stockPolicy: "UNIQUE", ...stock }]);

    const { default: ProductsPage } = await import("@/app/admin/(protected)/products/page");
    const html = renderToStaticMarkup((await ProductsPage({ searchParams: Promise.resolve({}) })) as ReactElement);

    expect(html).toContain(">Peça única<");
    expect(html).toContain(expectedBadge);
    expect(html).toContain("Política: Única");
    expect(html).not.toContain(">Estoque crítico<");
    expect(html).not.toContain(">Estoque baixo<");
    expect(html).not.toContain(">Esgotada<");
    expect(html).not.toContain(">Inconsistente<");
  }, 30000);

  it("shows a one-of-a-kind piece sold twice as inconsistent, with the reason", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([]);
    mocks.prisma.product.findMany.mockResolvedValueOnce([
      {
        id: "prod-unique", title: "Jaqueta Única", brand: null, active: true, featured: false, featuredSortOrder: null, priceInCents: 90000,
        weightGrams: 500, lengthCm: 30, widthCm: 30, heightCm: 5, category: null, subcategory: null, stockPolicy: "UNIQUE",
        variants: [{ stock: 0, reservedStock: 0 }], images: [],
      },
    ]);
    mockStockSnapshots([{ productId: "prod-unique", title: "Jaqueta Única", active: true, stockPolicy: "UNIQUE", variants: [{ active: true, stock: 0, reservedStock: 0 }], soldUnits: 2, openReservedUnits: 0, openReservationOrders: 0 }]);

    const { default: ProductsPage } = await import("@/app/admin/(protected)/products/page");
    const html = renderToStaticMarkup((await ProductsPage({ searchParams: Promise.resolve({}) })) as ReactElement);

    expect(html).toContain(">Inconsistente<");
    expect(html).toContain("Peça única vendida mais de uma vez");
  }, 30000);
});
