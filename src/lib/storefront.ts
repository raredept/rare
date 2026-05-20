import { Prisma } from "@prisma/client";
import { accessoryCatalogSubcategories, groupedCatalogCategories, primaryCatalogCategories } from "@/lib/catalog-categories";
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
const featuredProductOrderBy = [
  { featuredSortOrder: { sort: "asc", nulls: "last" } },
  { updatedAt: "desc" },
  { title: "asc" },
] satisfies Prisma.ProductOrderByWithRelationInput[];
const recentProductOrderBy = [{ createdAt: "desc" }, { sortOrder: "asc" }] satisfies Prisma.ProductOrderByWithRelationInput[];

export type HomeCategoryTile = {
  name: string;
  slug: string;
  href: string;
  description: string;
  total: number;
  status: "available" | "soon";
};

export type HomeCategoryTiles = {
  primary: HomeCategoryTile[];
  accessories: HomeCategoryTile[];
};

const homeCategoryDescriptions = new Map([
  ["camisetas", "Bases fortes para o dia a dia."],
  ["jaquetas", "Camadas com presença no outfit."],
  ["conjuntos", "Combinações prontas para sair."],
  ["bermudas", "Peças leves para rotação casual."],
  ["calcas", "Modelagens para compor a base."],
  ["acessorios", "Detalhes para fechar o visual."],
  ["bags", "Bags para completar o visual."],
  ["bones", "Bonés para completar o corre."],
  ["cuecas", "Essenciais com estoque limitado."],
  ["meias", "Complementos para entrar na rotação."],
  ["oculos", "Óculos para finalizar a composição."],
  ["relogios", "Relógios e detalhes de impacto."],
]);

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

type GroupingCategory = {
  name: string;
  slug: string;
};

function getProductGroupingSlug(product: StorefrontProduct, groupedSlugs = groupedCatalogCategorySlugs) {
  const subcategorySlug = product.subcategory?.slug;
  if (subcategorySlug && groupedSlugs.has(subcategorySlug)) {
    return subcategorySlug;
  }

  const categorySlug = product.category?.slug;
  if (categorySlug && groupedSlugs.has(categorySlug)) {
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

function sortHomeCategoryTiles(first: HomeCategoryTile, second: HomeCategoryTile) {
  const availabilityDiff = Number(second.status === "available") - Number(first.status === "available");
  if (availabilityDiff) return availabilityDiff;
  return 0;
}

function buildHomeCategoryTile(category: { name: string; slug: string }, total: number): HomeCategoryTile {
  return {
    name: category.name,
    slug: category.slug,
    href: `/categoria/${category.slug}`,
    description: homeCategoryDescriptions.get(category.slug) ?? "Peças escolhidas pela RARE.",
    total,
    status: total > 0 ? "available" : "soon",
  };
}

export async function getProducts(params?: {
  query?: string;
  categorySlug?: string;
  featuredOnly?: boolean;
  limit?: number;
  orderBy?: Prisma.ProductOrderByWithRelationInput[];
}) {
  return prisma.product.findMany({
    where: buildActiveProductWhere(params),
    include: productInclude,
    orderBy: params?.orderBy ?? productOrderBy,
    ...(params?.limit && params.limit > 0 ? { take: params.limit } : {}),
  });
}

export async function getFeaturedProducts(params?: { query?: string; limit?: number }) {
  return getProducts({ query: params?.query, featuredOnly: true, limit: params?.limit, orderBy: featuredProductOrderBy });
}

export async function getRecentProducts(params?: { query?: string; limit?: number }) {
  return getProducts({ query: params?.query, limit: params?.limit, orderBy: recentProductOrderBy });
}

export async function getHomeCategoryTiles(): Promise<HomeCategoryTiles> {
  const products = await prisma.product.findMany({
    where: buildActiveProductWhere(),
    select: {
      category: { select: { slug: true } },
      subcategory: { select: { slug: true } },
    },
  });

  const primaryCounts = new Map(primaryCatalogCategories.map((category) => [category.slug, 0]));
  const accessoryCounts = new Map(accessoryCatalogSubcategories.map((category) => [category.slug, 0]));

  for (const product of products) {
    const categorySlug = product.category?.slug ?? null;
    const subcategorySlug = product.subcategory?.slug ?? null;

    if (categorySlug === "acessorios" || (subcategorySlug && accessoryCounts.has(subcategorySlug))) {
      primaryCounts.set("acessorios", (primaryCounts.get("acessorios") ?? 0) + 1);
      if (subcategorySlug && accessoryCounts.has(subcategorySlug)) {
        accessoryCounts.set(subcategorySlug, (accessoryCounts.get(subcategorySlug) ?? 0) + 1);
      }
      continue;
    }

    if (categorySlug && primaryCounts.has(categorySlug)) {
      primaryCounts.set(categorySlug, (primaryCounts.get(categorySlug) ?? 0) + 1);
    }
  }

  return {
    primary: primaryCatalogCategories.map((category) => buildHomeCategoryTile(category, primaryCounts.get(category.slug) ?? 0)).sort(sortHomeCategoryTiles),
    accessories: accessoryCatalogSubcategories
      .map((category) => buildHomeCategoryTile(category, accessoryCounts.get(category.slug) ?? 0))
      .sort(sortHomeCategoryTiles),
  };
}

export async function getProductsGroupedByCategory(params?: {
  query?: string;
  categorySlug?: string;
  categories?: GroupingCategory[];
  limitPerCategory?: number;
  includeEmpty?: boolean;
}) {
  const groupingCategories = params?.categories ?? groupedCatalogCategories;
  const groupingSlugs = new Set(groupingCategories.map((category) => category.slug));
  const products = await prisma.product.findMany({
    where: buildActiveProductWhere({ query: params?.query, categorySlug: params?.categorySlug }),
    include: productInclude,
    orderBy: productOrderBy,
  });

  const groupedProducts = new Map<string, StorefrontProduct[]>();

  for (const product of products) {
    const slug = getProductGroupingSlug(product, groupingSlugs);
    if (!slug) continue;

    const productsForCategory = groupedProducts.get(slug) ?? [];
    productsForCategory.push(product);
    groupedProducts.set(slug, productsForCategory);
  }

  const limitPerCategory = params?.limitPerCategory ?? 8;

  return groupingCategories.flatMap<GroupedCatalogSection>((category) => {
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
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      products: await getFeaturedProducts({ query: params?.query }),
    };
  }

  if (slug === "tudo") {
    return {
      kind: "grouped" as const,
      slug,
      eyebrow: "Catálogo RARE",
      title: "Catálogo completo",
      description: "Explore todas as peças da RARE por categoria.",
      sections: await getProductsGroupedByCategory({ query: params?.query }),
    };
  }

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!category || !category.active) {
    return null;
  }

  if (category.children.length) {
    return {
      kind: "grouped" as const,
      slug,
      eyebrow: "Categoria",
      title: category.name,
      description: "Peças disponíveis agora nesta categoria, separadas por seção.",
      sections: await getProductsGroupedByCategory({
        categorySlug: slug,
        query: params?.query,
        categories: category.children,
      }),
    };
  }

  return {
    kind: "category" as const,
    slug,
    eyebrow: "Categoria",
    title: category.name,
    description: "Peças disponíveis agora nesta categoria.",
    products: await getProducts({ categorySlug: slug, query: params?.query }),
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
}
