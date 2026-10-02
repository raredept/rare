import { Prisma } from "@prisma/client";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-pagination";
import { prisma } from "@/lib/prisma";

export type AdminProductListFilters = {
  category?: string;
  featured?: "true";
  page: number;
  query?: string;
  status?: "active" | "hidden";
  stock?: "low" | "out";
};

type ProductIdRow = { id: string };
type CountRow = { count: number };

const productListInclude = Prisma.validator<Prisma.ProductInclude>()({
  category: true,
  subcategory: true,
  variants: { where: { active: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
});

function buildPrismaWhere(filters: AdminProductListFilters): Prisma.ProductWhereInput {
  return {
    ...(filters.query
      ? {
          OR: [
            { title: { contains: filters.query, mode: "insensitive" as const } },
            { brand: { contains: filters.query, mode: "insensitive" as const } },
          ],
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
    conditions.push(Prisma.sql`(product."title" ILIKE ${pattern} OR COALESCE(product."brand", '') ILIKE ${pattern})`);
  }
  if (filters.category) {
    conditions.push(Prisma.sql`(product."categoryId" = ${filters.category} OR product."subcategoryId" = ${filters.category})`);
  }
  if (filters.status === "active") conditions.push(Prisma.sql`product."active" = true`);
  if (filters.status === "hidden") conditions.push(Prisma.sql`product."active" = false`);
  if (filters.featured === "true") conditions.push(Prisma.sql`product."featured" = true`);
  if (filters.stock === "low") conditions.push(Prisma.sql`COALESCE(stock."available", 0) BETWEEN 1 AND 3`);
  if (filters.stock === "out") conditions.push(Prisma.sql`COALESCE(stock."available", 0) <= 0`);
  return conditions;
}

export async function getAdminProductRows(filters: AdminProductListFilters) {
  const skip = (filters.page - 1) * ADMIN_PAGE_SIZE;

  if (!filters.stock) {
    const rows = await prisma.product.findMany({
      where: buildPrismaWhere(filters),
      include: productListInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: ADMIN_PAGE_SIZE + 1,
    });
    return { products: rows.slice(0, ADMIN_PAGE_SIZE), hasNextPage: rows.length > ADMIN_PAGE_SIZE };
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
    ORDER BY product."sortOrder" ASC, product."createdAt" DESC
    OFFSET ${skip}
    LIMIT ${ADMIN_PAGE_SIZE + 1}
  `);
  const pageIds = idRows.slice(0, ADMIN_PAGE_SIZE).map((row) => row.id);
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
    hasNextPage: idRows.length > ADMIN_PAGE_SIZE,
  };
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
        WHERE variant."active" = true
        GROUP BY variant."productId"
        HAVING SUM(variant."stock" - variant."reservedStock") BETWEEN 1 AND 3
      ) AS low_stock_products
    `),
  ]);

  return { active, hidden, missingImages, lowStock: lowStockRows[0]?.count ?? 0 };
}
