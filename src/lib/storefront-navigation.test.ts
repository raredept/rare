import { describe, expect, it, vi } from "vitest";

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

describe("storefront navigation categories", () => {
  it("orders accessories dropdown children with the expected public sequence", async () => {
    mocks.prisma.category.findMany.mockResolvedValueOnce([
      {
        id: "cat-accessories",
        name: "Acessórios",
        slug: "acessorios",
        sortOrder: 7,
        children: [
          { id: "cat-relogios", name: "Relógios", slug: "relogios", sortOrder: 30 },
          { id: "cat-cuecas", name: "Cuecas", slug: "cuecas", sortOrder: 30 },
          { id: "cat-bags", name: "Bags", slug: "bags", sortOrder: 30 },
          { id: "cat-oculos", name: "Óculos", slug: "oculos", sortOrder: 30 },
          { id: "cat-bones", name: "Bonés", slug: "bones", sortOrder: 30 },
          { id: "cat-meias", name: "Meias", slug: "meias", sortOrder: 30 },
        ],
      },
    ]);

    const { getNavigationCategories } = await import("@/lib/storefront");
    const categories = await getNavigationCategories();

    expect(categories[0]?.children.map((category) => category.name)).toEqual([
      "Bags",
      "Bonés",
      "Cuecas",
      "Meias",
      "Óculos",
      "Relógios",
    ]);
  }, 60000);
});
