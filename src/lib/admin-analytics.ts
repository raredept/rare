import { Prisma, type OrderStatus } from "@prisma/client";
import { ANALYTICS_TIME_ZONE, listDays, type AnalyticsPeriod } from "@/lib/analytics-period";
import { paidRevenueStatuses } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

/**
 * Every figure here is aggregated by Postgres.
 *
 * The Admin previously read whole tables into the Node process and reduced them
 * in JavaScript, which grows linearly with the order history. Grouping and
 * summing in the database keeps one page load to a fixed set of small result
 * sets no matter how much the store has sold.
 *
 * Revenue is keyed on `paidAt`, not `createdAt`: an order only reaches a paid
 * status through the Stripe webhook, which always stamps `paidAt`, so it is the
 * moment money was actually taken. Days are commercial days in São Paulo, and
 * the conversion is done by Postgres from its own timezone table.
 */

export type DailySalesPoint = {
  day: string;
  orders: number;
  revenueInCents: number;
  itemsSold: number;
};

export type SalesTotals = {
  paidOrders: number;
  revenueInCents: number;
  subtotalInCents: number;
  shippingInCents: number;
  discountInCents: number;
  itemsSold: number;
  averageTicketInCents: number;
  averageItemsPerOrder: number;
};

export type StatusBreakdownEntry = {
  status: OrderStatus;
  orders: number;
  totalInCents: number;
};

export type TopEntry = {
  id: string;
  label: string;
  detail?: string | null;
  quantity: number;
  grossRevenueInCents: number;
};

export type InventorySummary = {
  totalStock: number;
  reservedStock: number;
  sellableStock: number;
  soldOutVariants: number;
  lowStockVariants: number;
  activeVariants: number;
  soldOutActiveProducts: number;
};

export type CriticalStockEntry = {
  productId: string;
  productTitle: string;
  size: string;
  stock: number;
  reservedStock: number;
  sellable: number;
};

export type AnalyticsOverview = {
  period: AnalyticsPeriod;
  timeZone: string;
  totals: SalesTotals;
  previousTotals: SalesTotals;
  series: DailySalesPoint[];
  statusBreakdown: StatusBreakdownEntry[];
  topProducts: TopEntry[];
  topCategories: TopEntry[];
  topVariants: TopEntry[];
  inventory: InventorySummary;
  criticalStock: CriticalStockEntry[];
  newCustomers: number;
};

/** A variant at or below this sellable count is surfaced as critical. */
export const LOW_STOCK_THRESHOLD = 3;

const TOP_ENTRY_LIMIT = 8;
const CRITICAL_STOCK_LIMIT = 12;

/**
 * Prisma stores DateTime as `timestamp without time zone` holding a UTC
 * instant, so a bare `AT TIME ZONE 'America/Sao_Paulo'` reads the value as if
 * it were already local and shifts every row three hours the wrong way. The
 * value has to be anchored to UTC first. Naming both zones explicitly also
 * keeps the result independent of the server's session timezone, which differs
 * between a developer machine and the deployed container.
 */
function commercialDayExpression(column: Prisma.Sql) {
  return Prisma.sql`to_char((${column} AT TIME ZONE 'UTC' AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date, 'YYYY-MM-DD')`;
}

/** Midnight of a commercial day, expressed the way the column stores it (naive UTC). */
function commercialDayBoundary(day: string, dayOffset: number) {
  // Both parameters are cast explicitly: Postgres cannot resolve `date + $n`
  // when the parameter arrives untyped.
  return Prisma.sql`(((${day}::date + ${dayOffset}::int)::timestamp AT TIME ZONE ${ANALYTICS_TIME_ZONE}) AT TIME ZONE 'UTC')`;
}

/** Paid orders whose payment landed inside the period's commercial days. */
function paidInPeriod(fromDay: string, toDay: string) {
  return Prisma.sql`
    "o"."status" = ANY(${paidRevenueStatuses}::"OrderStatus"[])
    AND "o"."paidAt" >= ${commercialDayBoundary(fromDay, 0)}
    AND "o"."paidAt" < ${commercialDayBoundary(toDay, 1)}
  `;
}

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function emptySalesTotals(): SalesTotals {
  return {
    paidOrders: 0,
    revenueInCents: 0,
    subtotalInCents: 0,
    shippingInCents: 0,
    discountInCents: 0,
    itemsSold: 0,
    averageTicketInCents: 0,
    averageItemsPerOrder: 0,
  };
}

/** Percentage change against the preceding window; null when there is no base to compare to. */
export function getTrendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type RawDailyRow = {
  day: string;
  orders: unknown;
  revenueInCents: unknown;
  itemsSold: unknown;
};

async function getDailySeries(period: AnalyticsPeriod): Promise<DailySalesPoint[]> {
  const rows = await prisma.$queryRaw<RawDailyRow[]>`
    SELECT
      "paid"."day" AS "day",
      COUNT(*)::int AS "orders",
      COALESCE(SUM("paid"."totalInCents"), 0)::bigint AS "revenueInCents",
      COALESCE(SUM("paid"."items"), 0)::bigint AS "itemsSold"
    FROM (
      SELECT
        ${commercialDayExpression(Prisma.sql`"o"."paidAt"`)} AS "day",
        "o"."totalInCents" AS "totalInCents",
        COALESCE((
          SELECT SUM("oi"."quantity") FROM "OrderItem" "oi" WHERE "oi"."orderId" = "o"."id"
        ), 0) AS "items"
      FROM "Order" "o"
      WHERE ${paidInPeriod(period.fromDay, period.toDay)}
    ) "paid"
    GROUP BY "paid"."day"
    ORDER BY "paid"."day"
  `;

  const byDay = new Map(rows.map((row) => [row.day, row]));

  // Days without sales must still appear, or the chart would compress the gaps
  // and imply sales happened on days that had none.
  return listDays(period.fromDay, period.toDay).map((day) => {
    const row = byDay.get(day);
    return {
      day,
      orders: toNumber(row?.orders),
      revenueInCents: toNumber(row?.revenueInCents),
      itemsSold: toNumber(row?.itemsSold),
    };
  });
}

type RawTotalsRow = {
  paidOrders: unknown;
  revenueInCents: unknown;
  subtotalInCents: unknown;
  shippingInCents: unknown;
  discountInCents: unknown;
  itemsSold: unknown;
};

async function getTotals(fromDay: string, toDay: string): Promise<SalesTotals> {
  const [row] = await prisma.$queryRaw<RawTotalsRow[]>`
    SELECT
      COUNT(*)::int AS "paidOrders",
      COALESCE(SUM("o"."totalInCents"), 0)::bigint AS "revenueInCents",
      COALESCE(SUM("o"."subtotalInCents"), 0)::bigint AS "subtotalInCents",
      COALESCE(SUM("o"."shippingInCents"), 0)::bigint AS "shippingInCents",
      COALESCE(SUM("o"."discountInCents"), 0)::bigint AS "discountInCents",
      COALESCE(SUM((
        SELECT SUM("oi"."quantity") FROM "OrderItem" "oi" WHERE "oi"."orderId" = "o"."id"
      )), 0)::bigint AS "itemsSold"
    FROM "Order" "o"
    WHERE ${paidInPeriod(fromDay, toDay)}
  `;

  const paidOrders = toNumber(row?.paidOrders);
  const revenueInCents = toNumber(row?.revenueInCents);
  const itemsSold = toNumber(row?.itemsSold);

  return {
    paidOrders,
    revenueInCents,
    subtotalInCents: toNumber(row?.subtotalInCents),
    shippingInCents: toNumber(row?.shippingInCents),
    discountInCents: toNumber(row?.discountInCents),
    itemsSold,
    // Integer cents throughout: the average is rounded once, at the end.
    averageTicketInCents: paidOrders ? Math.round(revenueInCents / paidOrders) : 0,
    averageItemsPerOrder: paidOrders ? Math.round((itemsSold / paidOrders) * 100) / 100 : 0,
  };
}

/**
 * Orders are counted by creation, not payment: this answers "what is in the
 * pipeline", which includes the orders that never got paid.
 */
async function getStatusBreakdown(period: AnalyticsPeriod): Promise<StatusBreakdownEntry[]> {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: {
      createdAt: {
        gte: commercialDayStart(period.fromDay),
        lt: commercialDayStart(period.toDay, 1),
      },
    },
    _count: { _all: true },
    _sum: { totalInCents: true },
  });

  return rows
    .map((row) => ({
      status: row.status,
      orders: row._count._all,
      totalInCents: row._sum.totalInCents ?? 0,
    }))
    .sort((first, second) => second.orders - first.orders);
}

/**
 * Prisma's typed API needs instants, so the São Paulo day boundary is built here
 * for those queries. Raw SQL lets Postgres do it instead.
 */
function commercialDayStart(day: string, addDays = 0) {
  const [year, month, date] = day.split("-").map(Number);
  const midnightUtc = Date.UTC(year, month - 1, date + addDays);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(midnightUtc));
  return new Date(midnightUtc - offsetMinutes * 60_000);
}

function getTimeZoneOffsetMinutes(instant: Date, timeZone = ANALYTICS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lookup = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour) % 24,
    Number(lookup.minute),
    Number(lookup.second),
  );

  return (asUtc - instant.getTime()) / 60_000;
}

type RawTopRow = {
  id: string | null;
  label: string | null;
  detail: string | null;
  quantity: unknown;
  grossRevenueInCents: unknown;
};

function toTopEntries(rows: RawTopRow[]): TopEntry[] {
  return rows
    .filter((row): row is RawTopRow & { id: string } => Boolean(row.id))
    .map((row) => ({
      id: row.id,
      label: row.label ?? "Sem título",
      detail: row.detail,
      quantity: toNumber(row.quantity),
      grossRevenueInCents: toNumber(row.grossRevenueInCents),
    }));
}

/**
 * Item revenue is the line total before the order-level coupon, so it does not
 * reconcile with paid revenue when discounts were used. The UI labels it gross.
 */
async function getTopProducts(fromDay: string, toDay: string) {
  const rows = await prisma.$queryRaw<RawTopRow[]>`
    SELECT
      "oi"."productId" AS "id",
      MAX("oi"."productTitleSnapshot") AS "label",
      NULL::text AS "detail",
      SUM("oi"."quantity")::int AS "quantity",
      SUM("oi"."totalInCents")::bigint AS "grossRevenueInCents"
    FROM "OrderItem" "oi"
    JOIN "Order" "o" ON "o"."id" = "oi"."orderId"
    WHERE ${paidInPeriod(fromDay, toDay)}
      AND "oi"."productId" IS NOT NULL
    GROUP BY "oi"."productId"
    ORDER BY "quantity" DESC, "grossRevenueInCents" DESC
    LIMIT ${TOP_ENTRY_LIMIT}
  `;

  return toTopEntries(rows);
}

async function getTopCategories(period: AnalyticsPeriod) {
  const rows = await prisma.$queryRaw<RawTopRow[]>`
    SELECT
      "c"."id" AS "id",
      MAX("c"."name") AS "label",
      NULL::text AS "detail",
      SUM("oi"."quantity")::int AS "quantity",
      SUM("oi"."totalInCents")::bigint AS "grossRevenueInCents"
    FROM "OrderItem" "oi"
    JOIN "Order" "o" ON "o"."id" = "oi"."orderId"
    JOIN "Product" "p" ON "p"."id" = "oi"."productId"
    JOIN "Category" "c" ON "c"."id" = "p"."categoryId"
    WHERE ${paidInPeriod(period.fromDay, period.toDay)}
    GROUP BY "c"."id"
    ORDER BY "quantity" DESC, "grossRevenueInCents" DESC
    LIMIT ${TOP_ENTRY_LIMIT}
  `;

  return toTopEntries(rows);
}

async function getTopVariants(period: AnalyticsPeriod) {
  const rows = await prisma.$queryRaw<RawTopRow[]>`
    SELECT
      "oi"."variantId" AS "id",
      MAX("oi"."productTitleSnapshot") AS "label",
      MAX("oi"."sizeSnapshot") AS "detail",
      SUM("oi"."quantity")::int AS "quantity",
      SUM("oi"."totalInCents")::bigint AS "grossRevenueInCents"
    FROM "OrderItem" "oi"
    JOIN "Order" "o" ON "o"."id" = "oi"."orderId"
    WHERE ${paidInPeriod(period.fromDay, period.toDay)}
      AND "oi"."variantId" IS NOT NULL
    GROUP BY "oi"."variantId"
    ORDER BY "quantity" DESC, "grossRevenueInCents" DESC
    LIMIT ${TOP_ENTRY_LIMIT}
  `;

  return toTopEntries(rows);
}

type RawInventoryRow = {
  totalStock: unknown;
  reservedStock: unknown;
  sellableStock: unknown;
  soldOutVariants: unknown;
  lowStockVariants: unknown;
  activeVariants: unknown;
};

export async function getInventorySummary(): Promise<InventorySummary> {
  const [[row], soldOutActiveProducts] = await Promise.all([
    prisma.$queryRaw<RawInventoryRow[]>`
      SELECT
        COALESCE(SUM("v"."stock"), 0)::bigint AS "totalStock",
        COALESCE(SUM("v"."reservedStock"), 0)::bigint AS "reservedStock",
        COALESCE(SUM(GREATEST("v"."stock" - "v"."reservedStock", 0)), 0)::bigint AS "sellableStock",
        COUNT(*) FILTER (WHERE "v"."stock" - "v"."reservedStock" <= 0)::int AS "soldOutVariants",
        COUNT(*) FILTER (
          WHERE "v"."stock" - "v"."reservedStock" > 0
            AND "v"."stock" - "v"."reservedStock" <= ${LOW_STOCK_THRESHOLD}
        )::int AS "lowStockVariants",
        COUNT(*)::int AS "activeVariants"
      FROM "ProductVariant" "v"
      JOIN "Product" "p" ON "p"."id" = "v"."productId"
      WHERE "v"."active" = true AND "p"."active" = true
    `,
    countSoldOutActiveProducts(),
  ]);

  return {
    totalStock: toNumber(row?.totalStock),
    reservedStock: toNumber(row?.reservedStock),
    sellableStock: toNumber(row?.sellableStock),
    soldOutVariants: toNumber(row?.soldOutVariants),
    lowStockVariants: toNumber(row?.lowStockVariants),
    activeVariants: toNumber(row?.activeVariants),
    soldOutActiveProducts,
  };
}

/** An active product with no sellable unit in any active variant, including one with no variants at all. */
async function countSoldOutActiveProducts() {
  const [row] = await prisma.$queryRaw<{ count: unknown }[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "Product" "p"
    WHERE "p"."active" = true
      AND NOT EXISTS (
        SELECT 1 FROM "ProductVariant" "v"
        WHERE "v"."productId" = "p"."id"
          AND "v"."active" = true
          AND "v"."stock" - "v"."reservedStock" > 0
      )
  `;
  return toNumber(row?.count);
}

export async function getCriticalStock(): Promise<CriticalStockEntry[]> {
  const variants = await prisma.productVariant.findMany({
    where: {
      active: true,
      product: { active: true },
    },
    select: {
      productId: true,
      size: true,
      stock: true,
      reservedStock: true,
      product: { select: { title: true } },
    },
    orderBy: [{ stock: "asc" }, { productId: "asc" }],
    take: 200,
  });

  return variants
    .map((variant) => ({
      productId: variant.productId,
      productTitle: variant.product.title,
      size: variant.size,
      stock: variant.stock,
      reservedStock: variant.reservedStock,
      sellable: variant.stock - variant.reservedStock,
    }))
    .filter((variant) => variant.sellable <= LOW_STOCK_THRESHOLD)
    .sort((first, second) => first.sellable - second.sellable)
    .slice(0, CRITICAL_STOCK_LIMIT);
}

async function countNewCustomers(period: AnalyticsPeriod) {
  return prisma.customer.count({
    where: {
      createdAt: {
        gte: commercialDayStart(period.fromDay),
        lt: commercialDayStart(period.toDay, 1),
      },
    },
  });
}

/** The window of the same length immediately before this one, for the trend arrows. */
export function getPreviousPeriodRange(period: AnalyticsPeriod) {
  const [year, month, date] = period.fromDay.split("-").map(Number);
  const fromIndex = Date.UTC(year, month - 1, date) / 86_400_000;
  const previousTo = new Date((fromIndex - 1) * 86_400_000).toISOString().slice(0, 10);
  const previousFrom = new Date((fromIndex - period.days) * 86_400_000).toISOString().slice(0, 10);
  return { fromDay: previousFrom, toDay: previousTo };
}

export async function getAnalyticsOverview(period: AnalyticsPeriod): Promise<AnalyticsOverview> {
  const previous = getPreviousPeriodRange(period);

  const [totals, previousTotals, series, statusBreakdown, topProducts, topCategories, topVariants, inventory, criticalStock, newCustomers] =
    await Promise.all([
      getTotals(period.fromDay, period.toDay),
      getTotals(previous.fromDay, previous.toDay),
      getDailySeries(period),
      getStatusBreakdown(period),
      getTopProducts(period.fromDay, period.toDay),
      getTopCategories(period),
      getTopVariants(period),
      getInventorySummary(),
      getCriticalStock(),
      countNewCustomers(period),
    ]);

  return {
    period,
    timeZone: ANALYTICS_TIME_ZONE,
    totals,
    previousTotals,
    series,
    statusBreakdown,
    topProducts,
    topCategories,
    topVariants,
    inventory,
    criticalStock,
    newCustomers,
  };
}

export type DashboardSnapshot = {
  /** Sales figures for the rolling window the dashboard labels. */
  window: SalesTotals;
  windowDays: number;
  revenueAllTimeInCents: number;
  paidOrdersAllTime: number;
  averageTicketAllTimeInCents: number;
  ordersByStatus: StatusBreakdownEntry[];
  ordersTotal: number;
  awaitingPayment: number;
  paidAwaitingFulfilment: number;
  failedOrCanceled: number;
  topProducts: TopEntry[];
  inventory: InventorySummary;
  criticalStock: CriticalStockEntry[];
  activeCustomers: number;
};

/**
 * Everything the dashboard shows, as aggregates.
 *
 * The page used to load every order with every item, every active variant and
 * every product into the Node process and reduce them in JavaScript. On a
 * 50k-order database that was ~1s of query time and ~129MB of heap per render,
 * growing with every sale. These queries answer the same questions in the
 * database and return a fixed number of small rows.
 */
export async function getDashboardSnapshot(windowDays = 30, now = new Date()): Promise<DashboardSnapshot> {
  const { getCommercialDay, addDays } = await import("@/lib/analytics-period");
  const today = getCommercialDay(now);
  const fromDay = addDays(today, -(windowDays - 1));

  const [window, allTime, statusRows, topProducts, inventory, criticalStock, activeCustomers] = await Promise.all([
    getTotals(fromDay, today),
    getAllTimeTotals(),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { totalInCents: true },
    }),
    getTopProducts(fromDay, today),
    getInventorySummary(),
    getCriticalStock(),
    prisma.customer.count({ where: { active: true } }),
  ]);

  const ordersByStatus = statusRows
    .map((row) => ({
      status: row.status,
      orders: row._count._all,
      totalInCents: row._sum.totalInCents ?? 0,
    }))
    .sort((first, second) => second.orders - first.orders);

  const countFor = (statuses: OrderStatus[]) =>
    ordersByStatus.filter((entry) => statuses.includes(entry.status)).reduce((sum, entry) => sum + entry.orders, 0);

  return {
    window,
    windowDays,
    revenueAllTimeInCents: allTime.revenueInCents,
    paidOrdersAllTime: allTime.paidOrders,
    averageTicketAllTimeInCents: allTime.averageTicketInCents,
    ordersByStatus,
    ordersTotal: ordersByStatus.reduce((sum, entry) => sum + entry.orders, 0),
    awaitingPayment: countFor(["pending", "awaiting_payment"]),
    // Paid but not yet handed to the carrier: the operator's actual to-do list.
    paidAwaitingFulfilment: countFor(["paid", "processing"]),
    failedOrCanceled: countFor(["canceled", "failed", "refunded"]),
    topProducts,
    inventory,
    criticalStock,
    activeCustomers,
  };
}

async function getAllTimeTotals(): Promise<SalesTotals> {
  const [row] = await prisma.$queryRaw<RawTotalsRow[]>`
    SELECT
      COUNT(*)::int AS "paidOrders",
      COALESCE(SUM("o"."totalInCents"), 0)::bigint AS "revenueInCents",
      COALESCE(SUM("o"."subtotalInCents"), 0)::bigint AS "subtotalInCents",
      COALESCE(SUM("o"."shippingInCents"), 0)::bigint AS "shippingInCents",
      COALESCE(SUM("o"."discountInCents"), 0)::bigint AS "discountInCents",
      0::bigint AS "itemsSold"
    FROM "Order" "o"
    WHERE "o"."status" = ANY(${paidRevenueStatuses}::"OrderStatus"[])
  `;

  const paidOrders = toNumber(row?.paidOrders);
  const revenueInCents = toNumber(row?.revenueInCents);

  return {
    paidOrders,
    revenueInCents,
    subtotalInCents: toNumber(row?.subtotalInCents),
    shippingInCents: toNumber(row?.shippingInCents),
    discountInCents: toNumber(row?.discountInCents),
    itemsSold: 0,
    averageTicketInCents: paidOrders ? Math.round(revenueInCents / paidOrders) : 0,
    averageItemsPerOrder: 0,
  };
}
