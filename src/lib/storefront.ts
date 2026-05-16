import { Prisma } from "@prisma/client";
import { accessoryCatalogSubcategories, groupedCatalogCategories } from "@/lib/catalog-categories";
import { prisma } from "@/lib/prisma";

export const productInclude = {
  category: true,
  subcategory: true,
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: { size: "asc" } },
} satisfies Prisma.ProductInclude;

export type StorefrontProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export type GroupedCatalogSection = {
  name: string;
  slug: string;
  href: string;
  products: StorefrontProduct[];
  total: number;
  hasMore: boolean;
};

const accessorySubcategoryOrder = new Map(accessoryCatalogSubcategories.map((category, index) => [category.slug, index]));
const groupedCatalogCategorySlugs = new Set(groupedCatalogCategories.map((category) => category.slug));
const productOrderBy = [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] satisfies Prisma.ProductOrderByWithRelationInput[];

function buildActiveProductWhere(params?: { query?: string; categorySlug?: string; featuredOnly?: boolean }) {
  const query = params?.query?.trim();
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(params?.featuredOnly ? { featured: true } : {}),
  };

  const and: Prisma.ProductWhereInput[] = [];

  if (query) {
    and.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { category: { name: { contains: query, mode: "insensitive" } } },
        { subcategory: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  if (params?.categorySlug) {
    and.push({
      OR: [{ category: { slug: params.categorySlug } }, { subcategory: { slug: params.categorySlug } }],
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
}

function getProductGroupingSlug(product: StorefrontProduct) {
  const subcategorySlug = product.subcategory?.slug;
  if (subcategorySlug && groupedCatalogCategorySlugs.has(subcategorySlug)) {
    return subcategorySlug;
  }

  const categorySlug = product.category?.slug;
  if (categorySlug && groupedCatalogCategorySlugs.has(categorySlug)) {
    return categorySlug;
  }

  return null;
}

export async function getNavigationCategories() {
  const categories = await prisma.category.findMany({
    where: { active: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      children: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  return categories.map((category) => {
    if (category.slug !== "acessorios") return category;

    return {
      ...category,
      children: [...category.children].sort((first, second) => {
        const firstOrder = accessorySubcategoryOrder.get(first.slug) ?? Number.MAX_SAFE_INTEGER;
        const secondOrder = accessorySubcategoryOrder.get(second.slug) ?? Number.MAX_SAFE_INTEGER;
        return firstOrder - secondOrder || first.sortOrder - second.sortOrder || first.name.localeCompare(second.name);
      }),
    };
  });
}

export async function getProducts(params?: { query?: string; categorySlug?: string; featuredOnly?: boolean }) {
  return prisma.product.findMany({
    where: buildActiveProductWhere(params),
    include: productInclude,
    orderBy: productOrderBy,
  });
}

export async function getFeaturedProducts(params?: { query?: string }) {
  return getProducts({ query: params?.query, featuredOnly: true });
}

export async function getProductsGroupedByCategory(params?: { query?: string; limitPerCategory?: number; includeEmpty?: boolean }) {
  const products = await prisma.product.findMany({
    where: buildActiveProductWhere({ query: params?.query }),
    include: productInclude,
    orderBy: productOrderBy,
  });

  const groupedProducts = new Map<string, StorefrontProduct[]>();

  for (const product of products) {
    const slug = getProductGroupingSlug(product);
    if (!slug) continue;

    const productsForCategory = groupedProducts.get(slug) ?? [];
    productsForCategory.push(product);
    groupedProducts.set(slug, productsForCategory);
  }

  const limitPerCategory = params?.limitPerCategory ?? 8;

  return groupedCatalogCategories.flatMap<GroupedCatalogSection>((category) => {
    const productsForCategory = groupedProducts.get(category.slug) ?? [];

    if (!productsForCategory.length && !params?.includeEmpty) {
      return [];
    }

    const productsToShow = limitPerCategory > 0 ? productsForCategory.slice(0, limitPerCategory) : productsForCategory;

    return [
      {
        name: category.name,
        slug: category.slug,
        href: `/categoria/${category.slug}`,
        products: productsToShow,
        total: productsForCategory.length,
        hasMore: limitPerCategory > 0 && productsForCategory.length > limitPerCategory,
      },
    ];
  });
}

export async function getCategoryPageData(slug: string, params?: { query?: string }) {
  if (slug === "destaques") {
    return {
      kind: "featured" as const,
      slug,
      eyebrow: "SELEÇÃO RARE",
      title: "Produtos em destaque",
      description: "Peças selecionadas em evidência na curadoria da loja.",
      products: await getFeaturedProducts({ query: params?.query }),
    };
  }

  if (slug === "tudo") {
    return {
      kind: "grouped" as const,
      slug,
      eyebrow: "CATÁLOGO RARE",
      title: "Todos os produtos",
      description: "Explore a curadoria completa por categoria.",
      sections: await getProductsGroupedByCategory({ query: params?.query }),
    };
  }

  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category || !category.active) {
    return null;
  }

  return {
    kind: "category" as const,
    slug,
    eyebrow: "Categoria",
    title: category.name,
    description: "Seleção atualizada de produtos ativos nesta categoria.",
    products: await getProducts({ categorySlug: slug, query: params?.query }),
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
}
