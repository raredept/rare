import { createElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CategoriesPage from "@/app/admin/(protected)/categories/page";

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
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

vi.mock("@/components/admin/admin-submit-button", () => ({
  AdminSubmitButton: ({ idleLabel, className }: { idleLabel: string; className?: string }) =>
    createElement("button", { type: "submit", className }, idleLabel),
}));

vi.mock("@/components/admin/confirm-button", () => ({
  ConfirmButton: ({ children, ...props }: { children: ReactNode }) => createElement("button", props, children),
}));

vi.mock("@/app/admin/(protected)/categories/actions", () => ({
  deleteCategoryAction: vi.fn(),
  saveCategoryAction: vi.fn(),
  toggleCategoryActiveAction: vi.fn(),
}));

function category(overrides: Record<string, unknown>) {
  return {
    id: "cat-1",
    name: "Categoria",
    slug: "categoria",
    parentId: null,
    parent: null,
    sortOrder: 10,
    active: true,
    _count: {
      children: 0,
      products: 0,
      subcategoryProducts: 0,
    },
    ...overrides,
  };
}

describe("admin categories page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps empty categories visible in admin management", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      category({
        id: "cat-camisetas",
        name: "Camisetas",
        slug: "camisetas",
        _count: { children: 0, products: 3, subcategoryProducts: 0 },
      }),
      category({
        id: "cat-bermudas",
        name: "Bermudas",
        slug: "bermudas",
        sortOrder: 40,
        _count: { children: 0, products: 0, subcategoryProducts: 0 },
      }),
    ]);

    const element = await CategoriesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);
    const query = mocks.prisma.category.findMany.mock.calls[0]?.[0] as { where?: unknown };

    expect(html).toContain("Camisetas");
    expect(html).toContain("Bermudas");
    expect(html).toContain("0 produto(s)");
    expect(query.where).toBeUndefined();
  });
});
