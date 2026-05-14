import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("CategoryNav render", () => {
  it("renders the full accessories dropdown from dynamic category children", async () => {
    const { CategoryNav } = await import("@/components/store/category-nav");
    const html = renderToStaticMarkup(
      createElement(CategoryNav, {
        categories: [
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
        ],
      }) as ReactElement,
    );

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
});
