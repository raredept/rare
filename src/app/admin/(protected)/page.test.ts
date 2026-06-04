import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    customer: {
      count: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.order.findMany.mockResolvedValue([]);
  mocks.prisma.productVariant.findMany.mockResolvedValue([]);
  mocks.prisma.product.findMany.mockResolvedValue([
    {
      id: "prod-no-media",
      title: "Produto sem midia",
      active: true,
      weightGrams: 500,
      lengthCm: 30,
      widthCm: 24,
      heightCm: 4,
      images: [],
      variants: [{ active: true, stock: 2, reservedStock: 0 }],
    },
  ]);
  mocks.prisma.category.findMany.mockResolvedValue([
    {
      id: "cat-empty",
      name: "Bags",
      active: true,
      _count: { products: 0, subcategoryProducts: 0 },
    },
  ]);
  mocks.prisma.customer.count.mockResolvedValue(0);
});

describe("AdminDashboardPage", () => {
  it("renders catalog issues with correction links", async () => {
    const { default: AdminDashboardPage } = await import("@/app/admin/(protected)/page");
    const element = await AdminDashboardPage();
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Pendencias do catalogo");
    expect(html).toContain("Produto sem midia sem midia principal");
    expect(html).toContain('href="/admin/products/prod-no-media/edit"');
    expect(html).toContain("Bags ativa sem produtos");
    expect(html).toContain('href="/admin/categories/cat-empty/edit"');
  });
});
