import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

const publicCategories = [
  {
    id: "cat-accessories",
    name: "Acessórios",
    slug: "acessorios",
    children: [
      { id: "cat-bags", name: "Bags", slug: "bags" },
      { id: "cat-bones", name: "Bonés", slug: "bones" },
      { id: "cat-cuecas", name: "Cuecas", slug: "cuecas" },
      { id: "cat-meias", name: "Meias", slug: "meias" },
      { id: "cat-oculos", name: "Óculos", slug: "oculos" },
      { id: "cat-relogios", name: "Relógios", slug: "relogios" },
    ],
  },
  { id: "cat-calcas", name: "Calças", slug: "calcas", children: [] },
  { id: "cat-camisetas", name: "Camisetas", slug: "camisetas", children: [] },
  { id: "cat-bermudas", name: "Bermudas", slug: "bermudas", children: [] },
  { id: "cat-conjuntos", name: "Conjuntos", slug: "conjuntos", children: [] },
  { id: "cat-jaquetas", name: "Jaquetas", slug: "jaquetas", children: [] },
];

async function renderNav() {
  const { CategoryNav } = await import("@/components/store/category-nav");
  return renderToStaticMarkup(createElement(CategoryNav, { categories: publicCategories }) as ReactElement);
}

describe("CategoryNav render", () => {
  beforeEach(() => {
    mocks.pathname = "/";
  });

  it("renders the requested public navigation order with virtual category links first", async () => {
    const html = await renderNav();

    expect(html.indexOf(">Destaques<")).toBeLessThan(html.indexOf(">Tudo<"));
    expect(html.indexOf(">Tudo<")).toBeLessThan(html.indexOf(">Camisetas<"));
    expect(html.indexOf(">Camisetas<")).toBeLessThan(html.indexOf(">Jaquetas<"));
    expect(html.indexOf(">Jaquetas<")).toBeLessThan(html.indexOf(">Conjuntos<"));
    expect(html.indexOf(">Conjuntos<")).toBeLessThan(html.indexOf(">Bermudas<"));
    expect(html.indexOf(">Bermudas<")).toBeLessThan(html.indexOf(">Calças<"));
    expect(html.indexOf(">Calças<")).toBeLessThan(html.indexOf(">Acessórios<"));
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain('href="/categoria/tudo"');
  }, 60000);

  it("renders the full accessories dropdown from dynamic category children", async () => {
    const html = await renderNav();

    expect(html).toContain("Ver todos");
    expect(html).toContain("Bags");
    expect(html).toContain("Bonés");
    expect(html).toContain("Cuecas");
    expect(html).toContain("Meias");
    expect(html).toContain("Óculos");
    expect(html).toContain("Relógios");
    expect(html).toContain("/categoria/cuecas");
    expect(html).toContain("/categoria/meias");
    expect(html).toContain("/categoria/oculos");
    expect(html).toContain("/categoria/relogios");
  }, 60000);

  it("marks Destaque active only on the featured virtual route", async () => {
    mocks.pathname = "/categoria/destaques";

    const html = await renderNav();

    expect(html).toMatch(/href="\/categoria\/destaques"[^>]*aria-current="page"/);
    expect(html).not.toMatch(/href="\/categoria\/tudo"[^>]*aria-current="page"/);
  }, 60000);

  it("marks Tudo active only on the grouped catalog virtual route", async () => {
    mocks.pathname = "/categoria/tudo";

    const html = await renderNav();

    expect(html).toMatch(/href="\/categoria\/tudo"[^>]*aria-current="page"/);
    expect(html).not.toMatch(/href="\/categoria\/destaques"[^>]*aria-current="page"/);
  }, 60000);

  it("marks accessories active when an accessory child route is open", async () => {
    mocks.pathname = "/categoria/bags";

    const html = await renderNav();

    expect(html).toMatch(/aria-current="page"[^>]*>Acessórios/);
    expect(html).toMatch(/href="\/categoria\/bags"[^>]*aria-current="page"/);
  }, 60000);
});
