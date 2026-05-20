import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductForm } from "@/components/admin/product-form";

vi.mock("@/app/admin/(protected)/products/actions", () => ({
  saveProductAction: vi.fn(),
}));

describe("ProductForm", () => {
  it("renders the manual featured order field with clear help text", () => {
    const html = renderToStaticMarkup(
      createElement(ProductForm, {
        categories: [],
      }) as ReactElement,
    );

    expect(html).toContain("Produto em destaque");
    expect(html).toContain("Ordem nos destaques");
    expect(html).toContain('name="featuredSortOrder"');
    expect(html).toContain('min="1"');
    expect(html).toContain("Produtos com número menor aparecem primeiro em Destaques do mês.");
    expect(html).toContain("Ative o destaque para usar essa ordem.");
  });

  it("renders category and subcategory selects from A to Z", () => {
    const html = renderToStaticMarkup(
      createElement(ProductForm, {
        categories: [
          { id: "cat-camisetas", name: "Camisetas", parentId: null },
          { id: "cat-acessorios", name: "Acessórios", parentId: null },
          { id: "cat-bermudas", name: "Bermudas", parentId: null },
          { id: "cat-relogios", name: "Relógios", parentId: "cat-acessorios" },
          { id: "cat-bags", name: "Bags", parentId: "cat-acessorios" },
          { id: "cat-bolsas-bag", name: "Bolsas/Bag", parentId: "cat-acessorios", active: false },
          { id: "cat-oculos", name: "Óculos", parentId: "cat-acessorios" },
        ],
      }) as ReactElement,
    );

    expect(html.indexOf('<option value="cat-acessorios">Acessórios</option>')).toBeLessThan(
      html.indexOf('<option value="cat-bermudas">Bermudas</option>'),
    );
    expect(html.indexOf('<option value="cat-bermudas">Bermudas</option>')).toBeLessThan(
      html.indexOf('<option value="cat-camisetas">Camisetas</option>'),
    );
    expect(html.indexOf('<option value="cat-bags">Bags</option>')).toBeLessThan(
      html.indexOf('<option value="cat-oculos">Óculos</option>'),
    );
    expect(html.indexOf('<option value="cat-oculos">Óculos</option>')).toBeLessThan(
      html.indexOf('<option value="cat-relogios">Relógios</option>'),
    );
    expect(html).not.toContain("Bolsas/Bag");
    expect(html).toContain('<option value="cat-bags">Bags</option>');
  });
});
