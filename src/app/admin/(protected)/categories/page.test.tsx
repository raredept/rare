import { createElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/auth";

// Every Admin page checks the session itself; the page logic is what is under test here.
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })) }));
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
  ConfirmButton: ({ children, className, type }: { children: ReactNode; className?: string; type?: "submit" }) =>
    createElement("button", { className, type }, children),
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

  it("keeps empty categories visible when searchParams is absent", async () => {
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

    const element = await CategoriesPage({});
    const html = renderToStaticMarkup(element as ReactElement);
    const query = mocks.prisma.category.findMany.mock.calls[0]?.[0] as { where?: unknown };

    expect(html).toContain("Camisetas");
    expect(html).toContain("Bermudas");
    expect(html).toContain("0 produto(s)");
    expect(query.where).toBeUndefined();
    expect(requireAdmin).toHaveBeenCalledOnce();
  });

  it("preserves text, status and parent filters from promised searchParams", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      category({ id: "cat-parent", name: "Acessórios", slug: "acessorios" }),
      category({
        id: "cat-bags",
        name: "Bags",
        slug: "bags",
        parentId: "cat-parent",
        parent: { id: "cat-parent", name: "Acessórios" },
      }),
      category({
        id: "cat-hidden-bags",
        name: "Bags ocultas",
        slug: "bags-ocultas",
        active: false,
        parentId: "cat-parent",
        parent: { id: "cat-parent", name: "Acessórios" },
      }),
      category({ id: "cat-root-bags", name: "Bags principais", slug: "bags-principais" }),
      category({
        id: "cat-hats",
        name: "Bonés",
        slug: "bones",
        parentId: "cat-parent",
        parent: { id: "cat-parent", name: "Acessórios" },
      }),
    ]);

    const element = await CategoriesPage({
      searchParams: Promise.resolve({ q: " BAGS ", status: "active", parent: "cat-parent" }),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain('href="/admin/categories/cat-bags/edit"');
    expect(html).not.toContain('href="/admin/categories/cat-hidden-bags/edit"');
    expect(html).not.toContain('href="/admin/categories/cat-root-bags/edit"');
    expect(html).not.toContain('href="/admin/categories/cat-hats/edit"');
    expect(html).not.toContain('href="/admin/categories/cat-parent/edit"');
    expect(html).toContain('value=" BAGS "');
    expect(html).toContain('<option value="active" selected="">Ativas</option>');
    expect(html).toContain('<option value="cat-parent" selected="">Subcategorias de Acessórios</option>');
    expect(mocks.prisma.category.findMany).toHaveBeenCalledWith({
      include: {
        parent: true,
        _count: { select: { children: true, products: true, subcategoryProducts: true } },
      },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    expect(requireAdmin).toHaveBeenCalledOnce();
  });

  it("authorizes before loading categories with absent searchParams", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(CategoriesPage({})).rejects.toThrow("Unauthorized");
    expect(mocks.prisma.category.findMany).not.toHaveBeenCalled();
  });
});
