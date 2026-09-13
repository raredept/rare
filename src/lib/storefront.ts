import { Prisma } from "@prisma/client";
import { accessoryCatalogSubcategories, groupedCatalogCategories, primaryCatalogCategories } from "@/lib/catalog-categories";
import { prisma } from "@/lib/prisma";
import { isVariantPurchasable } from "@/lib/stock";
import { buildCatalogPageHref, CATALOG_PAGE_SIZE, normalizeCatalogPage } from "@/lib/catalog-pagination";

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

function buildActiveProductWhere(params?: { query?: string; categorySlug?: string; brand?: string; featuredOnly?: boolean }) {
  const query = params?.query?.trim();
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(params?.featuredOnly ? { featured: true } : {}),
    ...(params?.brand?.trim() ? { brand: { equals: params.brand.trim(), mode: "insensitive" as const } } : {}),
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

type CategoryAvailabilityProduct = {
  category: { slug: string } | null;
  subcategory: { slug: string } | null;
  variants: { active: boolean; stock: number; reservedStock: number }[];
};

function buildPublishedProductCountsByCategorySlug(products: CategoryAvailabilityProduct[]) {
  const counts = new Map<string, number>();

  for (const product of products) {
    const slugs = new Set([product.category?.slug, product.subcategory?.slug].filter((slug): slug is string => Boolean(slug)));
    for (const slug of slugs) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  return counts;
}

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
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        children: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.product.findMany({
      where: buildActiveProductWhere(),
      select: {
        category: { select: { slug: true } },
        subcategory: { select: { slug: true } },
        variants: { select: { active: true, stock: true, reservedStock: true } },
      },
    }),
  ]);
  const productCountsBySlug = buildPublishedProductCountsByCategorySlug(products);

  return categories.flatMap((category) => {
    const childrenWithProducts = category.children.filter((child) => (productCountsBySlug.get(child.slug) ?? 0) > 0);
    const hasProducts = (productCountsBySlug.get(category.slug) ?? 0) > 0 || childrenWithProducts.length > 0;
    if (!hasProducts) return [];

    return {
      ...category,
      children:
        category.slug === "acessorios"
          ? [...childrenWithProducts].sort((first, second) => {
              const firstOrder = accessorySubcategoryOrder.get(first.slug) ?? Number.MAX_SAFE_INTEGER;
              const secondOrder = accessorySubcategoryOrder.get(second.slug) ?? Number.MAX_SAFE_INTEGER;
              return firstOrder - secondOrder || first.sortOrder - second.sortOrder || first.name.localeCompare(second.name);
            })
          : childrenWithProducts,
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
  brand?: string;
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: Prisma.ProductOrderByWithRelationInput[];
}) {
  const where = buildActiveProductWhere(params);
  const purchasable = { active: true, stock: { gt: prisma.productVariant.fields.reservedStock } };
  const availableWhere: Prisma.ProductWhereInput = { AND: [where, { variants: { some: purchasable } }] };
  const soldOutWhere: Prisma.ProductWhereInput = { AND: [where, { variants: { none: purchasable } }] };
  const orderBy = [...(params?.orderBy ?? productOrderBy), { id: "asc" as const }];
  const requestedOffset = params?.offset ?? 0;
  const requestedLimit = params?.limit ?? 0;
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.max(1, Math.trunc(requestedLimit)) : undefined;

  // Grouping happens in PostgreSQL BEFORE skip/take. One snapshot prevents a
  // stock mutation between the two groups from duplicating/skipping a product.
  return prisma.$transaction(async (tx) => {
    const availableCount = offset ? await tx.product.count({ where: availableWhere }) : 0;
    const available = await tx.product.findMany({
      where: availableWhere, include: productInclude, orderBy, skip: offset, take: limit,
    });
    if (limit && available.length === limit) return available;
    const soldOut = await tx.product.findMany({
      where: soldOutWhere, include: productInclude, orderBy,
      skip: Math.max(0, offset - availableCount), take: limit ? limit - available.length : undefined,
    });
    return [...available, ...soldOut];
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getAvailableBrandsForStore(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, brand: { not: null }, variants: { some: {
      active: true, stock: { gt: prisma.productVariant.fields.reservedStock },
    } } },
    select: { brand: true }, distinct: ["brand"], orderBy: [{ brand: "asc" }, { id: "asc" }],
  });
  const brands = new Map<string, string>();
  for (const row of rows) {
    const name = row.brand?.normalize("NFC").trim().replace(/\s+/g, " ");
    if (name && !brands.has(name.toLocaleLowerCase("pt-BR"))) brands.set(name.toLocaleLowerCase("pt-BR"), name);
  }
  return [...brands.values()];
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
      variants: { select: { active: true, stock: true, reservedStock: true } },
    },
  });

  const primaryCounts = new Map(primaryCatalogCategories.map((category) => [category.slug, 0]));
  const accessoryCounts = new Map(accessoryCatalogSubcategories.map((category) => [category.slug, 0]));

  for (const product of products) {
    if (!product.variants.some((variant) => isVariantPurchasable(variant))) continue;

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
    primary: primaryCatalogCategories
      .map((category) => buildHomeCategoryTile(category, primaryCounts.get(category.slug) ?? 0))
      .filter((tile) => tile.total > 0)
      .sort(sortHomeCategoryTiles),
    accessories: accessoryCatalogSubcategories
      .map((category) => buildHomeCategoryTile(category, accessoryCounts.get(category.slug) ?? 0))
      .filter((tile) => tile.total > 0)
      .sort(sortHomeCategoryTiles),
  };
}

export async function getProductsGroupedByCategory(params?: {
  query?: string;
  brand?: string;
  categorySlug?: string;
  categories?: GroupingCategory[];
  limitPerCategory?: number;
  includeEmpty?: boolean;
}) {
  const groupingCategories = params?.categories ?? groupedCatalogCategories;
  const groupingSlugs = new Set(groupingCategories.map((category) => category.slug));
  const products = await getProducts({ query: params?.query, brand: params?.brand, categorySlug: params?.categorySlug });

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
        href: buildCatalogPageHref(category.slug, params),
        products: productsToShow,
        total: productsForCategory.length,
        hasMore: limitPerCategory > 0 && productsForCategory.length > limitPerCategory,
      },
    ];
  });
}

export async function getCategoryPageData(slug: string, params?: { query?: string; brand?: string; page?: number }) {
  const page = normalizeCatalogPage(params?.page);
  async function loadProductPage(categorySlug?: string, featuredOnly = false) {
    const products = await getProducts({ categorySlug, featuredOnly, query: params?.query, brand: params?.brand,
      limit: CATALOG_PAGE_SIZE + 1, offset: (page - 1) * CATALOG_PAGE_SIZE,
      ...(featuredOnly ? { orderBy: featuredProductOrderBy } : {}),
    });
    return { products: products.slice(0, CATALOG_PAGE_SIZE), page, hasMore: products.length > CATALOG_PAGE_SIZE };
  }
  if (slug === "destaques") {
    return {
      kind: "featured" as const,
      slug,
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      ...await loadProductPage(undefined, true),
    };
  }

  if (slug === "tudo") {
    return {
      kind: "grouped" as const,
      slug,
      eyebrow: "Catálogo RARE",
      title: "Catálogo completo",
      description: "Explore todas as peças da RARE por categoria.",
      sections: await getProductsGroupedByCategory({ query: params?.query, brand: params?.brand, limitPerCategory: 10 }),
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
      description: "Peças da RARE nesta categoria, separadas por seção.",
      sections: await getProductsGroupedByCategory({
        categorySlug: slug,
        query: params?.query,
        brand: params?.brand,
        categories: category.children,
      }),
    };
  }

  return {
    kind: "category" as const,
    slug,
    eyebrow: "Categoria",
    title: category.name,
    description: "Peças selecionadas pela RARE nesta categoria.",
    ...await loadProductPage(slug),
  };
}

export async function isCategoryPageSlugAvailable(slug: string) {
  if (slug === "destaques" || slug === "tudo") {
    return true;
  }

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { active: true },
  });

  return Boolean(category?.active);
}

export async function isProductPageSlugAvailable(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    select: { id: true },
  });

  return Boolean(product);
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
}

export async function getPublicSitemapCatalogData() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        slug: true,
        updatedAt: true,
        featured: true,
        category: { select: { slug: true } },
        subcategory: { select: { slug: true } },
      },
    }),
  ]);
  const categorySlugsWithProducts = new Set(
    products.flatMap((product) => [product.category?.slug, product.subcategory?.slug].filter((slug): slug is string => Boolean(slug))),
  );

  return {
    categories: categories.filter((category) => categorySlugsWithProducts.has(category.slug)),
    products,
    hasFeaturedProducts: products.some((product) => product.featured),
  };
}
