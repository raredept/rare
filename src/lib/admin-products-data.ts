import { Prisma } from "@prisma/client";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";
import { skuSearchTerm } from "@/lib/sku";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock-policy";
import { PRODUCT_CATALOG_ORDER_BY, readCatalogOrder } from "@/lib/product-catalog-order";

export type AdminProductListFilters = {
  category?: string;
  featured?: "true";
  page: number;
  query?: string;
  status?: "active" | "hidden";
  /** low / out: replenishable (STANDARD) items by quantity. unique / unique-unavailable: one-of-a-kind pieces. */
  stock?: AdminProductStockFilter;
};

export const ADMIN_PRODUCT_STOCK_FILTERS = ["low", "out", "unique", "unique-unavailable"] as const;
export type AdminProductStockFilter = (typeof ADMIN_PRODUCT_STOCK_FILTERS)[number];

export function parseAdminProductStockFilter(value: unknown): AdminProductStockFilter | undefined {
  return (ADMIN_PRODUCT_STOCK_FILTERS as readonly unknown[]).includes(value) ? (value as AdminProductStockFilter) : undefined;
}

type ProductIdRow = { id: string };
type CountRow = { count: number };

const productListInclude = Prisma.validator<Prisma.ProductInclude>()({
  category: true,
  subcategory: true,
  variants: { where: { active: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
});

function buildPrismaWhere(filters: AdminProductListFilters): Prisma.ProductWhereInput {
  const skuTerm = skuSearchTerm(filters.query);
  return {
    ...(filters.query
      ? {
          AND: [{ OR: [
            { title: { contains: filters.query, mode: "insensitive" as const } },
            { brand: { contains: filters.query, mode: "insensitive" as const } },
            // SKUs are stored normalized (trimmed, upper case), so the term is normalized too.
            ...(skuTerm ? [{ variants: { some: { sku: { contains: skuTerm } } } }] : []),
          ] }],
        }
      : {}),
    ...(filters.category
      ? { OR: [{ categoryId: filters.category }, { subcategoryId: filters.category }] }
      : {}),
    ...(filters.status === "active" ? { active: true } : {}),
    ...(filters.status === "hidden" ? { active: false } : {}),
    ...(filters.featured === "true" ? { featured: true } : {}),
  };
}

function buildSqlConditions(filters: AdminProductListFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const skuTerm = skuSearchTerm(filters.query);
    const skuCondition = skuTerm
      ? Prisma.sql` OR EXISTS (SELECT 1 FROM "ProductVariant" AS sku_variant WHERE sku_variant."productId" = product."id" AND sku_variant."sku" LIKE ${`%${skuTerm}%`})`
      : Prisma.empty;
    conditions.push(Prisma.sql`(product."title" ILIKE ${pattern} OR COALESCE(product."brand", '') ILIKE ${pattern}${skuCondition})`);
  }
  if (filters.category) {
    conditions.push(Prisma.sql`(product."categoryId" = ${filters.category} OR product."subcategoryId" = ${filters.category})`);
  }
  if (filters.status === "active") conditions.push(Prisma.sql`product."active" = true`);
  if (filters.status === "hidden") conditions.push(Prisma.sql`product."active" = false`);
  if (filters.featured === "true") conditions.push(Prisma.sql`product."featured" = true`);
  // Quantity filters only make sense for replenishable items: a one-of-a-kind piece with one unit is
  // not "low" and a sold one is not "out of stock".
  if (filters.stock === "low") conditions.push(Prisma.sql`product."stockPolicy" = 'STANDARD' AND COALESCE(stock."available", 0) BETWEEN 1 AND ${LOW_STOCK_THRESHOLD}`);
  if (filters.stock === "out") conditions.push(Prisma.sql`product."stockPolicy" = 'STANDARD' AND COALESCE(stock."available", 0) <= 0`);
  if (filters.stock === "unique") conditions.push(Prisma.sql`product."stockPolicy" = 'UNIQUE'`);
  if (filters.stock === "unique-unavailable") conditions.push(Prisma.sql`product."stockPolicy" = 'UNIQUE' AND COALESCE(stock."available", 0) <= 0`);
  return conditions;
}

/**
 * One page of the Admin list plus the row right before and right after it (`previousId` /
 * `nextId`), so ↑ on the first row and ↓ on the last row can still move a piece across pages.
 */
export async function getAdminProductRows(filters: AdminProductListFilters) {
  const skip = (filters.page - 1) * ADMIN_PAGE_SIZE;
  // Read one row before the page (when there is one) and one after it.
  const hasPreviousRow = skip > 0;
  const windowSkip = hasPreviousRow ? skip - 1 : 0;
  const windowTake = ADMIN_PAGE_SIZE + 1 + (hasPreviousRow ? 1 : 0);
  const splitWindow = <T extends { id: string }>(rows: T[]) => {
    const pageRows = hasPreviousRow ? rows.slice(1) : rows;
    return {
      products: pageRows.slice(0, ADMIN_PAGE_SIZE),
      hasNextPage: pageRows.length > ADMIN_PAGE_SIZE,
      previousId: hasPreviousRow ? (rows[0]?.id ?? null) : null,
      nextId: pageRows[ADMIN_PAGE_SIZE]?.id ?? null,
    };
  };

  if (!filters.stock) {
    const rows = await prisma.product.findMany({
      where: buildPrismaWhere(filters),
      include: productListInclude,
      orderBy: PRODUCT_CATALOG_ORDER_BY,
      skip: windowSkip,
      take: windowTake,
    });
    return splitWindow(rows);
  }

  const conditions = buildSqlConditions(filters);
  const idRows = await prisma.$queryRaw<ProductIdRow[]>(Prisma.sql`
    WITH stock AS (
      SELECT variant."productId", SUM(variant."stock" - variant."reservedStock")::int AS "available"
      FROM "ProductVariant" AS variant
      WHERE variant."active" = true
      GROUP BY variant."productId"
    )
    SELECT product."id"
    FROM "Product" AS product
    LEFT JOIN stock ON stock."productId" = product."id"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY product."sortOrder" ASC, product."createdAt" DESC, product."id" ASC
    OFFSET ${windowSkip}
    LIMIT ${windowTake}
  `);
  const window = splitWindow(idRows);
  const pageIds = window.products.map((row) => row.id);
  const unorderedProducts = pageIds.length
    ? await prisma.product.findMany({
        where: { id: { in: pageIds } },
        include: productListInclude,
      })
    : [];
  const productById = new Map(unorderedProducts.map((product) => [product.id, product]));

  return {
    products: pageIds.flatMap((id) => {
      const product = productById.get(id);
      return product ? [product] : [];
    }),
    hasNextPage: window.hasNextPage,
    previousId: window.previousId,
    nextId: window.nextId,
  };
}

/** 1-based position of every product in the manual catalog order (the number the form shows). */
export async function getCatalogPositions() {
  const ids = await readCatalogOrder(prisma);
  return new Map(ids.map((id, index) => [id, index + 1]));
}

export async function getAdminProductSummary() {
  const [active, hidden, missingImages, lowStockRows] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: false } }),
    prisma.product.count({ where: { images: { none: {} } } }),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM (
        SELECT variant."productId"
        FROM "ProductVariant" AS variant
        JOIN "Product" AS product ON product."id" = variant."productId"
        WHERE variant."active" = true AND product."stockPolicy" = 'STANDARD'
        GROUP BY variant."productId"
        HAVING SUM(variant."stock" - variant."reservedStock") BETWEEN 1 AND ${LOW_STOCK_THRESHOLD}
      ) AS low_stock_products
    `),
  ]);

  return { active, hidden, missingImages, lowStock: lowStockRows[0]?.count ?? 0 };
}
