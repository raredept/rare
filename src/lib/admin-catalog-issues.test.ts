import { describe, expect, it } from "vitest";
import { buildCatalogIssues, type CatalogIssueCategory, type CatalogIssueProduct } from "@/lib/admin-catalog-issues";

function product(overrides: Partial<CatalogIssueProduct> = {}): CatalogIssueProduct {
  return {
    id: "prod-valid",
    title: "Camiseta RARE",
    active: true,
    weightGrams: 500,
    lengthCm: 30,
    widthCm: 24,
    heightCm: 4,
    images: [{ url: "https://media.rare.example/products/camiseta.webp" }],
    variants: [{ active: true, stock: 4, reservedStock: 1 }],
    ...overrides,
  };
}

function category(overrides: Partial<CatalogIssueCategory> = {}): CatalogIssueCategory {
  return {
    id: "cat-valid",
    name: "Camisetas",
    active: true,
    _count: { products: 1, subcategoryProducts: 0 },
    ...overrides,
  };
}

describe("admin catalog issues", () => {
  it("lists active product without available stock as a catalog issue", () => {
    const issues = buildCatalogIssues({
      products: [product({ id: "prod-no-stock", variants: [{ active: true, stock: 1, reservedStock: 1 }] })],
      categories: [category()],
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "active-product-no-stock",
        href: "/admin/products/prod-no-stock/edit",
      }),
    );
  });

  it("lists active product without primary media as a catalog issue", () => {
    const issues = buildCatalogIssues({
      products: [product({ id: "prod-no-media", images: [] })],
      categories: [category()],
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "active-product-no-media",
        href: "/admin/products/prod-no-media/edit",
      }),
    );
  });

  it("lists active empty category as a catalog issue", () => {
    const issues = buildCatalogIssues({
      products: [product()],
      categories: [category({ id: "cat-empty", name: "Bags", _count: { products: 0, subcategoryProducts: 0 } })],
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        type: "active-category-empty",
        href: "/admin/categories/cat-empty/edit",
      }),
    );
  });

  it("does not list a valid active product as a catalog issue", () => {
    const issues = buildCatalogIssues({
      products: [product({ id: "prod-ready" })],
      categories: [category()],
    });

    expect(issues.some((issue) => issue.href === "/admin/products/prod-ready/edit")).toBe(false);
  });
});
