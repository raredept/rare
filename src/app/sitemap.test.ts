import { beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

const mocks = vi.hoisted(() => ({
  getPublicSitemapCatalogData: vi.fn(),
}));

vi.mock("@/lib/storefront", () => ({
  getPublicSitemapCatalogData: mocks.getPublicSitemapCatalogData,
}));

describe("sitemap metadata route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists canonical public static, category, and active product URLs", async () => {
    const categoryUpdatedAt = new Date("2026-05-30T10:00:00.000Z");
    const childUpdatedAt = new Date("2026-05-31T10:00:00.000Z");
    const productUpdatedAt = new Date("2026-06-01T10:00:00.000Z");

    mocks.getPublicSitemapCatalogData.mockResolvedValueOnce({
      categories: [
        { slug: "camisetas", updatedAt: categoryUpdatedAt },
        { slug: "bags", updatedAt: childUpdatedAt },
      ],
      products: [
        { slug: "camiseta-rare", updatedAt: productUpdatedAt, featured: true },
        { slug: "jaqueta-esgotada", updatedAt: productUpdatedAt, featured: false },
      ],
      hasFeaturedProducts: true,
    });

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
      "https://raredept.com.br/produto/jaqueta-esgotada",
    ]));
    expect(urls).not.toEqual(expect.arrayContaining([
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
    mocks.getPublicSitemapCatalogData.mockRejectedValueOnce(new Error("DATABASE_URL must remain private"));

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      "https://raredept.com.br",
      "https://raredept.com.br/sobre",
    ]));
    expect(urls).not.toContain("https://raredept.com.br/categoria/tudo");
    expect(urls).not.toEqual(expect.arrayContaining(["DATABASE_URL must remain private"]));
    expect(consoleError).toHaveBeenCalledWith("Failed to build public sitemap.");

    consoleError.mockRestore();
  });
});
