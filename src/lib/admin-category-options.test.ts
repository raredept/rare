import { describe, expect, it } from "vitest";
import {
  getAdminCategoryFilterLabel,
  sortAdminCategoryFilterOptions,
  sortProductFormCategoryOptions,
} from "@/lib/admin-category-options";

describe("admin category options", () => {
  it("sorts product form category options alphabetically by name", () => {
    const categories = sortProductFormCategoryOptions([
      { id: "cat-camisetas", name: "Camisetas", parentId: null },
      { id: "cat-acessorios", name: "Acessórios", parentId: null },
      { id: "cat-bermudas", name: "Bermudas", parentId: null },
    ]);

    expect(categories.map((category) => category.name)).toEqual(["Acessórios", "Bermudas", "Camisetas"]);
  });

  it("sorts flattened product filter options by their visible label", () => {
    const categories = sortAdminCategoryFilterOptions([
      { id: "cat-camisetas", name: "Camisetas", parent: null },
      { id: "cat-bags", name: "Bags", parent: { id: "cat-acessorios", name: "Acessórios" } },
      { id: "cat-acessorios", name: "Acessórios", parent: null },
    ]);

    expect(categories.map(getAdminCategoryFilterLabel)).toEqual(["Acessórios", "Acessórios / Bags", "Camisetas"]);
  });
});
