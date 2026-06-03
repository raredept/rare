import { beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

const mocks = vi.hoisted(() => ({
  getNavigationCategories: vi.fn(),
  getProducts: vi.fn(),
}));

vi.mock("@/lib/storefront", () => ({
  getNavigationCategories: mocks.getNavigationCategories,
  getProducts: mocks.getProducts,
}));

describe("sitemap metadata route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists canonical public static, category, and available product URLs", async () => {
    const categoryUpdatedAt = new Date("2026-05-30T10:00:00.000Z");
    const childUpdatedAt = new Date("2026-05-31T10:00:00.000Z");
    const productUpdatedAt = new Date("2026-06-01T10:00:00.000Z");

    mocks.getNavigationCategories.mockResolvedValueOnce([
      {
        id: "cat-camisetas",
        name: "Camisetas",
        slug: "camisetas",
        updatedAt: categoryUpdatedAt,
        children: [
          {
            id: "cat-bags",
            name: "Bags",
            slug: "bags",
            updatedAt: childUpdatedAt,
          },
        ],
      },
    ]);
    mocks.getProducts.mockResolvedValueOnce([
      {
        id: "prod-available",
        slug: "camiseta-rare",
        updatedAt: productUpdatedAt,
        variants: [{ active: true, stock: 2, reservedStock: 1 }],
      },
      {
        id: "prod-sold-out",
        slug: "jaqueta-esgotada",
        updatedAt: productUpdatedAt,
        variants: [{ active: true, stock: 1, reservedStock: 1 }],
      },
      {
        id: "prod-inactive-variant",
        slug: "bone-indisponivel",
        updatedAt: productUpdatedAt,
        variants: [{ active: false, stock: 3, reservedStock: 0 }],
      },
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      "https://raredept.com.br",
      "https://raredept.com.br/sobre",
      "https://raredept.com.br/contato",
      "https://raredept.com.br/politica-de-envio",
      "https://raredept.com.br/privacidade-e-termos",
      "https://raredept.com.br/trocas-e-devolucoes",
      "https://raredept.com.br/categoria/tudo",
      "https://raredept.com.br/categoria/destaques",
      "https://raredept.com.br/categoria/camisetas",
      "https://raredept.com.br/categoria/bags",
      "https://raredept.com.br/produto/camiseta-rare",
    ]));
    expect(urls).not.toEqual(expect.arrayContaining([
      "https://raredept.com.br/produto/jaqueta-esgotada",
      "https://raredept.com.br/produto/bone-indisponivel",
      "https://raredept.com.br/admin",
      "https://raredept.com.br/api",
      "https://raredept.com.br/finalizar-compra",
      "https://raredept.com.br/minha-conta",
    ]));
    expect(entries.find((entry) => entry.url.endsWith("/categoria/camisetas"))?.lastModified).toBe(categoryUpdatedAt);
    expect(entries.find((entry) => entry.url.endsWith("/produto/camiseta-rare"))?.lastModified).toBe(productUpdatedAt);
  });

  it("falls back to non-sensitive public routes when database reads fail", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getNavigationCategories.mockRejectedValueOnce(new Error("postgres://secret@example.invalid"));
    mocks.getProducts.mockResolvedValueOnce([]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      "https://raredept.com.br",
      "https://raredept.com.br/sobre",
      "https://raredept.com.br/categoria/tudo",
    ]));
    expect(urls).not.toEqual(expect.arrayContaining(["postgres://secret@example.invalid"]));
    expect(consoleError).toHaveBeenCalledWith("Failed to build public sitemap.");

    consoleError.mockRestore();
  });
});
