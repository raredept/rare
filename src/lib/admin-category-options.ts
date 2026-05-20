const categoryCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });

type NamedCategory = {
  id: string;
  name: string;
};

export type ProductFormCategoryOption = NamedCategory & {
  parentId: string | null;
};

export type AdminCategoryFilterOption = NamedCategory & {
  parent?: NamedCategory | null;
};

function compareByNameAndId(first: NamedCategory, second: NamedCategory) {
  return categoryCollator.compare(first.name, second.name) || first.id.localeCompare(second.id);
}

export function sortProductFormCategoryOptions<T extends ProductFormCategoryOption>(categories: T[]) {
  return [...categories].sort(compareByNameAndId);
}

export function getAdminCategoryFilterLabel(category: AdminCategoryFilterOption) {
  return category.parent ? `${category.parent.name} / ${category.name}` : category.name;
}

export function sortAdminCategoryFilterOptions<T extends AdminCategoryFilterOption>(categories: T[]) {
  return [...categories].sort((first, second) => {
    return (
      categoryCollator.compare(getAdminCategoryFilterLabel(first), getAdminCategoryFilterLabel(second)) ||
      first.id.localeCompare(second.id)
    );
  });
}
