import { cache } from "react";
import { Prisma } from "@prisma/client";
import { accessoryCatalogSubcategories, primaryCatalogCategories } from "@/lib/catalog-categories";
import { getPreferredCategoryOrder } from "@/lib/catalog-shortcuts";
import { prisma } from "@/lib/prisma";
import { isVariantPurchasable } from "@/lib/stock";
import { buildCatalogPageHref, CATALOG_PAGE_SIZE, normalizeCatalogPage } from "@/lib/catalog-pagination";
import {
  applyCatalogRefinements,
  buildCatalogFacets,
  DEFAULT_CATALOG_REFINEMENTS,
  hasActiveRefinements,
  type CatalogRefinements,
} from "@/lib/catalog-refinements";
import { isPromotionsEnabled } from "@/lib/feature-flags";
import {
  compareCollections,
  getCollectionDescription,
  getCollectionLabel,
  isCollectionLive,
  isCollectionSlug,
  toNavigationCollection,
  type NavigationCollection,
} from "@/lib/promotions/collections";
import { loadApplicablePromotionRules } from "@/lib/promotions/store";
import { priceProduct, selectPromotionForProduct, type ProductPrice } from "@/lib/promotions/engine";

export const productInclude = {
  category: true,
  subcategory: true,
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: { size: "asc" } },
} satisfies Prisma.ProductInclude;

type StorefrontProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
/** A catalog product with its server-computed price (automatic promotion applied, if any). */
export type StorefrontProduct = StorefrontProductRow & { pricing: ProductPrice };

// One read of the applicable promotions per request render; prices are always computed on the
// server from the catalog price and these rules. Dates are evaluated at the request instant.
const getRequestPromotionRules = cache(async () => {
  const now = new Date();
  try {
    return { now, rules: await loadApplicablePromotionRules(prisma, now) };
  } catch (error) {
    // Fail toward the catalog price: the checkout reads the rules again on its own and never
    // charges more than the catalog price, so a display failure cannot overcharge anyone.
    console.error("[promotions] could not load promotion rules for the storefront", error instanceof Error ? error.name : "unknown");
    return { now, rules: [] };
  }
});

async function attachPricing(rows: StorefrontProductRow[]): Promise<StorefrontProduct[]> {
  if (!rows.length) return [];
  const { now, rules } = await getRequestPromotionRules();
  return rows.map((row) => ({ ...row, pricing: priceProduct(rules, row, now) }));
}

export type GroupedCatalogSection = {
  name: string;
  slug: string;
  /** Null for the catch-all section, which has no category page to link to. */
  href: string | null;
  products: StorefrontProduct[];
  total: number;
  hasMore: boolean;
};

const accessorySubcategoryOrder = new Map(accessoryCatalogSubcategories.map((category, index) => [category.slug, index]));
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

/** The home tile line of a real category (existing store copy), reused by its meta description. */
export function getCategoryTagline(slug: string) {
  return homeCategoryDescriptions.get(slug) ?? null;
}

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

function getProductGroupingSlug(product: StorefrontProduct, groupedSlugs: Set<string>) {
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

// Memoised per request: the store layout and the category page both need it, and
// it reads every active product to count what each category can show.
export const getNavigationCategories = cache(async function getNavigationCategories() {
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
});

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
  /** Extra filter ANDed with the active-product filter (e.g. a promotion's targets). */
  where?: Prisma.ProductWhereInput;
}) {
  const where = params?.where ? { AND: [buildActiveProductWhere(params), params.where] } : buildActiveProductWhere(params);
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
  const rows = await prisma.$transaction(async (tx) => {
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
  return attachPricing(rows);
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

type SectionCategory = { name: string; slug: string; active?: boolean; sortOrder?: number };

const CATCH_ALL_SECTION = { name: "Outras peças", slug: "outras-pecas" };

function isListedCategory(category: SectionCategory | null | undefined): category is SectionCategory {
  return Boolean(category) && category?.active !== false;
}

/**
 * The complete catalog ("Tudo") used to group products by a hardcoded list of
 * category slugs, so every product in any other category — including one the
 * operator creates in the Admin — silently vanished from it. On staging the
 * page said the catalog was empty while six products were active.
 *
 * Sections now come from the products themselves: the product's active
 * subcategory, else its active category, else a catch-all section with no
 * link (there is no category page to send it to). Order follows the
 * navigation: preferred category order, then the accessory subcategory order.
 */
function getCompleteCatalogSection(product: StorefrontProduct) {
  const category = product.category as SectionCategory | null;
  const subcategory = product.subcategory as SectionCategory | null;
  const own = isListedCategory(subcategory) ? subcategory : isListedCategory(category) ? category : null;
  if (!own) {
    return { ...CATCH_ALL_SECTION, linked: false, rank: [Number.MAX_SAFE_INTEGER, 0, "", 0, 0, ""] as const };
  }

  const parent = own === subcategory && category ? category : own;
  const isChild = own === subcategory && Boolean(category);
  return {
    name: own.name,
    slug: own.slug,
    linked: true,
    rank: [
      getPreferredCategoryOrder(parent),
      parent.sortOrder ?? 0,
      parent.name,
      isChild ? accessorySubcategoryOrder.get(own.slug) ?? Number.MAX_SAFE_INTEGER : -1,
      isChild ? own.sortOrder ?? 0 : -1,
      own.name,
    ] as const,
  };
}

function compareRanks(first: readonly (number | string)[], second: readonly (number | string)[]) {
  for (let index = 0; index < first.length; index += 1) {
    const a = first[index];
    const b = second[index];
    const difference = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    if (difference) return difference;
  }
  return 0;
}

function buildSection(
  meta: { name: string; slug: string; linked: boolean },
  products: StorefrontProduct[],
  limitPerCategory: number,
  params?: { query?: string; brand?: string },
): GroupedCatalogSection {
  return {
    name: meta.name,
    slug: meta.slug,
    href: meta.linked ? buildCatalogPageHref(meta.slug, params) : null,
    products: limitPerCategory > 0 ? products.slice(0, limitPerCategory) : products,
    total: products.length,
    hasMore: limitPerCategory > 0 && products.length > limitPerCategory,
  };
}

export async function getProductsGroupedByCategory(params?: {
  query?: string;
  brand?: string;
  categorySlug?: string;
  categories?: GroupingCategory[];
  limitPerCategory?: number;
  includeEmpty?: boolean;
  /** Already loaded (and brand-filtered) scope, to avoid reading the catalog twice. */
  products?: StorefrontProduct[];
}) {
  const products = params?.products ?? await getProducts({ query: params?.query, brand: params?.brand, categorySlug: params?.categorySlug });
  const limitPerCategory = params?.limitPerCategory ?? 8;

  if (!params?.categories) {
    const sections = new Map<string, { meta: ReturnType<typeof getCompleteCatalogSection>; products: StorefrontProduct[] }>();
    for (const product of products) {
      const meta = getCompleteCatalogSection(product);
      const section = sections.get(meta.slug) ?? { meta, products: [] };
      section.products.push(product);
      sections.set(meta.slug, section);
    }
    return [...sections.values()]
      .sort((first, second) => compareRanks(first.meta.rank, second.meta.rank))
      // The catch-all has no page behind a "Ver todos" link, so it shows everything.
      .map(({ meta, products: sectionProducts }) => buildSection(meta, sectionProducts, meta.linked ? limitPerCategory : 0, params));
  }

  const groupingCategories = params.categories;
  const groupingSlugs = new Set(groupingCategories.map((category) => category.slug));
  const groupedProducts = new Map<string, StorefrontProduct[]>();

  for (const product of products) {
    const slug = getProductGroupingSlug(product, groupingSlugs);
    if (!slug) continue;

    const productsForCategory = groupedProducts.get(slug) ?? [];
    productsForCategory.push(product);
    groupedProducts.set(slug, productsForCategory);
  }

  return groupingCategories.flatMap<GroupedCatalogSection>((category) => {
    const productsForCategory = groupedProducts.get(category.slug) ?? [];

    if (!productsForCategory.length && !params.includeEmpty) {
      return [];
    }

    return [buildSection({ ...category, linked: true }, productsForCategory, limitPerCategory, params)];
  });
}

export async function getCategoryPageData(
  slug: string,
  params?: { query?: string; brand?: string; page?: number },
  refinements: CatalogRefinements = DEFAULT_CATALOG_REFINEMENTS,
) {
  const page = normalizeCatalogPage(params?.page);
  const refined = hasActiveRefinements(refinements);

  // UIUX-CATALOG-001: the whole scope (category / search) is read once — the catalog has dozens of
  // products, not thousands — so the filter options, the real total and the sort all come from the
  // same rows. The incoming order is unchanged (available first, then the catalog order).
  async function loadScope(categorySlug?: string, featuredOnly = false) {
    return getProducts({ categorySlug, featuredOnly, query: params?.query, ...(featuredOnly ? { orderBy: featuredProductOrderBy } : {}) });
  }
  function toProductPage(scope: StorefrontProduct[]) {
    const results = applyCatalogRefinements(scope, refinements, params?.brand);
    const offset = (page - 1) * CATALOG_PAGE_SIZE;
    return {
      products: results.slice(offset, offset + CATALOG_PAGE_SIZE),
      page,
      hasMore: results.length > offset + CATALOG_PAGE_SIZE,
      total: results.length,
      facets: buildCatalogFacets(scope, refinements, params?.brand),
    };
  }
  async function toGroupedSections(scope: StorefrontProduct[], options: { categorySlug?: string; categories?: GroupingCategory[]; limitPerCategory?: number }) {
    const results = applyCatalogRefinements(scope, refinements, params?.brand);
    return {
      sections: await getProductsGroupedByCategory({ ...options, query: params?.query, brand: params?.brand, products: results }),
      total: results.length,
      facets: buildCatalogFacets(scope, refinements, params?.brand),
    };
  }

  if (slug === "destaques") {
    return {
      kind: "featured" as const,
      slug,
      eyebrow: "Destaques RARE",
      title: "Destaques da loja",
      description: "Peças em evidência na RARE — selecionadas por estilo, procura e presença.",
      ...toProductPage(await loadScope(undefined, true)),
    };
  }

  if (slug === "tudo") {
    const scope = await loadScope();
    const meta = { slug, eyebrow: "Catálogo RARE", title: "Catálogo completo", description: "Explore todas as peças da RARE por categoria." };
    // Filtered or sorted: one flat, paginated list (sections would hide the chosen order).
    return refined
      ? { kind: "filtered" as const, ...meta, ...toProductPage(scope) }
      : { kind: "grouped" as const, ...meta, ...await toGroupedSections(scope, { limitPerCategory: 10 }) };
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
    const scope = await loadScope(slug);
    const meta = { slug, eyebrow: "Categoria", title: category.name, description: "Peças da RARE nesta categoria, separadas por seção." };
    return refined
      ? { kind: "filtered" as const, ...meta, ...toProductPage(scope) }
      : { kind: "grouped" as const, ...meta, ...await toGroupedSections(scope, { categorySlug: slug, categories: category.children }) };
  }

  return {
    kind: "category" as const,
    slug,
    eyebrow: "Categoria",
    title: category.name,
    description: "Peças selecionadas pela RARE nesta categoria.",
    ...toProductPage(await loadScope(slug)),
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
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
  if (!product) return null;
  const [priced] = await attachPricing([product]);
  return priced;
}

type PromotionTargets = {
  scope: "ALL_PRODUCTS" | "SELECTED_PRODUCTS" | "SELECTED_CATEGORIES";
  products: { productId: string }[];
  categories: { categoryId: string }[];
};

/** The products a promotion TARGETS (category OR subcategory, as the engine reads them). */
function promotionTargetWhere(promotion: PromotionTargets): Prisma.ProductWhereInput {
  if (promotion.scope === "ALL_PRODUCTS") return {};
  if (promotion.scope === "SELECTED_PRODUCTS") return { id: { in: promotion.products.map((item) => item.productId) } };
  const categoryIds = promotion.categories.map((item) => item.categoryId);
  return { OR: [{ categoryId: { in: categoryIds } }, { subcategoryId: { in: categoryIds } }] };
}

/**
 * Active products whose WINNING promotion right now is this one (the engine decides: another,
 * higher-priority or bigger promotion may own some of its targets, and a price too low for the
 * discount is skipped). Available first, sold-out last, in catalog order — like every listing.
 * Shared by the homepage campaign and the storefront collections: no second pricing rule.
 */
async function getPromotionWinnerProducts(promotionId: string, targets: PromotionTargets) {
  const scope = await getProducts({ where: promotionTargetWhere(targets) });
  return scope.filter((product) => product.pricing.promotion?.id === promotionId);
}

/** Products shown in a homepage campaign (first `limit` of the campaign's winning products). */
export async function getCampaignProducts(campaignId: string, limit = 8) {
  const promotion = await prisma.promotion.findUnique({
    where: { id: campaignId },
    select: { scope: true, products: { select: { productId: true } }, categories: { select: { categoryId: true } } },
  });
  if (!promotion) return [];
  return (await getPromotionWinnerProducts(campaignId, promotion)).slice(0, limit);
}

const collectionSelect = {
  id: true, name: true, slug: true, status: true, value: true, startsAt: true, endsAt: true, scope: true,
  headline: true, subheadline: true, badgeText: true,
  storefrontCollectionEnabled: true, storefrontCollectionLabel: true, storefrontCollectionSortOrder: true,
  products: { select: { productId: true } }, categories: { select: { categoryId: true } },
} satisfies Prisma.PromotionSelect;

/**
 * RARE-COLLECTIONS-CART-01: a public collection, or null (404) when it is not public right now —
 * flag off, not effectively ACTIVE (draft, scheduled, paused, ended), promotions switched off, or no
 * active product currently won by this promotion.
 */
export const getPublicCollection = cache(async function getPublicCollection(slug: string) {
  if (!isPromotionsEnabled() || !isCollectionSlug(slug)) return null;
  const promotion = await prisma.promotion.findUnique({ where: { slug }, select: collectionSelect });
  if (!promotion || !isCollectionLive(promotion, new Date())) return null;
  const products = await getPromotionWinnerProducts(promotion.id, promotion);
  if (!products.length) return null;
  return {
    id: promotion.id,
    slug: promotion.slug,
    label: getCollectionLabel(promotion),
    description: getCollectionDescription(promotion),
    badgeText: promotion.badgeText,
    endsAt: promotion.endsAt,
    products,
  };
});

/** The collection page: same filters, sort and pagination as the catalog ("Em promoção" is implied). */
export async function getCollectionPageData(slug: string, params: { brand?: string; page?: number }, refinements: CatalogRefinements) {
  const collection = await getPublicCollection(slug);
  if (!collection) return null;
  const page = normalizeCatalogPage(params.page);
  const effective = { ...refinements, promo: false };
  const results = applyCatalogRefinements(collection.products, effective, params.brand);
  const offset = (page - 1) * CATALOG_PAGE_SIZE;
  return {
    collection,
    refinements: effective,
    products: results.slice(offset, offset + CATALOG_PAGE_SIZE),
    page,
    hasMore: results.length > offset + CATALOG_PAGE_SIZE,
    total: results.length,
    facets: { ...buildCatalogFacets(collection.products, effective, params.brand), promoCount: 0 },
  };
}

/**
 * Collections for the store menu: flag on, effectively ACTIVE and winning at least one active
 * product now. Two queries in total (candidates + one light product read), whatever the number of
 * collections — no query per collection.
 */
export const getNavigationCollections = cache(async function getNavigationCollections(): Promise<NavigationCollection[]> {
  if (!isPromotionsEnabled()) return [];
  const now = new Date();
  const candidates = await prisma.promotion.findMany({
    where: {
      storefrontCollectionEnabled: true,
      status: { in: ["ACTIVE", "SCHEDULED"] },
      value: { not: null },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    select: { id: true, name: true, slug: true, status: true, value: true, startsAt: true, endsAt: true, storefrontCollectionEnabled: true, storefrontCollectionLabel: true, storefrontCollectionSortOrder: true },
    take: 50,
  });
  const live = candidates.filter((promotion) => isCollectionLive(promotion, now));
  if (!live.length) return [];
  const [{ now: rulesNow, rules }, products] = await Promise.all([
    getRequestPromotionRules(),
    prisma.product.findMany({ where: { active: true }, select: { id: true, priceInCents: true, categoryId: true, subcategoryId: true } }),
  ]);
  const winning = new Set(products.map((product) => selectPromotionForProduct(rules, product, rulesNow)?.rule.id).filter(Boolean));
  return live.filter((promotion) => winning.has(promotion.id)).map(toNavigationCollection).sort(compareCollections);
});

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
