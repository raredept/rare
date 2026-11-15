import { Prisma } from "@prisma/client";
import { commercialDayBoundary, toNumber } from "@/lib/admin-analytics";
import type { AnalyticsPeriod } from "@/lib/analytics-period";
import { paidRevenueStatuses } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

// Aggregates for /admin/analytics/site. Two sources, kept apart on purpose:
//  - behaviour (visits, sessions, views, clicks, add to cart): SiteAnalyticsEvent, which only holds
//    visitors who accepted analytics, so these are a lower bound of the real traffic;
//  - operations (checkout started, payment started, purchase confirmed): the orders themselves,
//    read on the server whatever the visitor chose. The browser can never post them.
// Every figure is a count; no row identifies a person.

const TOP_LIMIT = 8;

export type SiteAnalyticsTotals = {
  visitors: number;
  sessions: number;
  pageViews: number;
  productViews: number;
  productClicks: number;
  addToCart: number;
  checkoutStarted: number;
  paymentStarted: number;
  purchaseConfirmed: number;
};

export type SiteAnalyticsTopEntry = { productId: string; label: string; count: number };

export type SiteAnalyticsDailyPoint = { day: string; pageViews: number; sessions: number };

export type SiteAnalyticsReport = {
  totals: SiteAnalyticsTotals;
  /** purchaseConfirmed / sessions; null without consented sessions. */
  sessionConversion: number | null;
  /** purchaseConfirmed / checkoutStarted (server data only); null without checkouts. */
  checkoutConversion: number | null;
  topViewed: SiteAnalyticsTopEntry[];
  topClicked: SiteAnalyticsTopEntry[];
  topSold: SiteAnalyticsTopEntry[];
  daily: SiteAnalyticsDailyPoint[];
  devices: Array<{ device: string; sessions: number }>;
};

function eventsInPeriod(period: AnalyticsPeriod) {
  return Prisma.sql`"e"."createdAt" >= ${commercialDayBoundary(period.fromDay, 0)} AND "e"."createdAt" < ${commercialDayBoundary(period.toDay, 1)}`;
}

function ordersCreatedInPeriod(period: AnalyticsPeriod) {
  return Prisma.sql`"o"."createdAt" >= ${commercialDayBoundary(period.fromDay, 0)} AND "o"."createdAt" < ${commercialDayBoundary(period.toDay, 1)}`;
}

export function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

async function topEvents(period: AnalyticsPeriod, type: "product_view" | "product_click") {
  const rows = await prisma.$queryRaw<Array<{ productId: string; label: string | null; count: unknown }>>`
    SELECT "e"."productId", "p"."title" AS "label", COUNT(*)::int AS "count"
    FROM "SiteAnalyticsEvent" "e"
    LEFT JOIN "Product" "p" ON "p"."id" = "e"."productId"
    WHERE ${eventsInPeriod(period)} AND "e"."type" = ${type} AND "e"."productId" IS NOT NULL
    GROUP BY "e"."productId", "p"."title"
    ORDER BY "count" DESC, "e"."productId" ASC
    LIMIT ${TOP_LIMIT}
  `;
  return rows.map((row) => ({ productId: row.productId, label: row.label ?? "Produto removido", count: toNumber(row.count) }));
}

async function topSold(period: AnalyticsPeriod) {
  const rows = await prisma.$queryRaw<Array<{ productId: string; label: string; count: unknown }>>`
    SELECT COALESCE("oi"."productId", 'removed') AS "productId", MAX("oi"."productTitleSnapshot") AS "label", SUM("oi"."quantity")::int AS "count"
    FROM "OrderItem" "oi"
    JOIN "Order" "o" ON "o"."id" = "oi"."orderId"
    WHERE "o"."status" = ANY(${paidRevenueStatuses}::"OrderStatus"[])
      AND "o"."paidAt" >= ${commercialDayBoundary(period.fromDay, 0)}
      AND "o"."paidAt" < ${commercialDayBoundary(period.toDay, 1)}
    GROUP BY COALESCE("oi"."productId", 'removed')
    ORDER BY "count" DESC, "productId" ASC
    LIMIT ${TOP_LIMIT}
  `;
  return rows.map((row) => ({ productId: row.productId, label: row.label, count: toNumber(row.count) }));
}

export async function getSiteAnalyticsReport(period: AnalyticsPeriod): Promise<SiteAnalyticsReport> {
  const [[behaviour], [operations], viewed, clicked, sold, dailyRows, deviceRows] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        COUNT(DISTINCT "e"."visitorHash")::int AS "visitors",
        COUNT(DISTINCT "e"."sessionHash")::int AS "sessions",
        COUNT(*) FILTER (WHERE "e"."type" = 'page_view')::int AS "pageViews",
        COUNT(*) FILTER (WHERE "e"."type" = 'product_view')::int AS "productViews",
        COUNT(*) FILTER (WHERE "e"."type" = 'product_click')::int AS "productClicks",
        COUNT(*) FILTER (WHERE "e"."type" = 'add_to_cart')::int AS "addToCart"
      FROM "SiteAnalyticsEvent" "e"
      WHERE ${eventsInPeriod(period)}
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        (SELECT COUNT(*)::int FROM "Order" "o" WHERE ${ordersCreatedInPeriod(period)}) AS "checkoutStarted",
        (SELECT COUNT(*)::int FROM "Order" "o" WHERE ${ordersCreatedInPeriod(period)}
          AND ("o"."asaasPaymentId" IS NOT NULL OR "o"."mercadoPagoPaymentId" IS NOT NULL OR "o"."stripeCheckoutSessionId" IS NOT NULL OR "o"."paidAt" IS NOT NULL)) AS "paymentStarted",
        (SELECT COUNT(*)::int FROM "Order" "o" WHERE "o"."status" = ANY(${paidRevenueStatuses}::"OrderStatus"[])
          AND "o"."paidAt" >= ${commercialDayBoundary(period.fromDay, 0)} AND "o"."paidAt" < ${commercialDayBoundary(period.toDay, 1)}) AS "purchaseConfirmed"
    `,
    topEvents(period, "product_view"),
    topEvents(period, "product_click"),
    topSold(period),
    prisma.$queryRaw<Array<{ day: string; pageViews: unknown; sessions: unknown }>>`
      SELECT to_char(("e"."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS "day",
        COUNT(*) FILTER (WHERE "e"."type" = 'page_view')::int AS "pageViews",
        COUNT(DISTINCT "e"."sessionHash")::int AS "sessions"
      FROM "SiteAnalyticsEvent" "e"
      WHERE ${eventsInPeriod(period)}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ device: string; sessions: unknown }>>`
      SELECT "e"."device", COUNT(DISTINCT "e"."sessionHash")::int AS "sessions"
      FROM "SiteAnalyticsEvent" "e"
      WHERE ${eventsInPeriod(period)}
      GROUP BY "e"."device"
      ORDER BY "sessions" DESC, "e"."device" ASC
    `,
  ]);

  const totals: SiteAnalyticsTotals = {
    visitors: toNumber(behaviour?.visitors),
    sessions: toNumber(behaviour?.sessions),
    pageViews: toNumber(behaviour?.pageViews),
    productViews: toNumber(behaviour?.productViews),
    productClicks: toNumber(behaviour?.productClicks),
    addToCart: toNumber(behaviour?.addToCart),
    checkoutStarted: toNumber(operations?.checkoutStarted),
    paymentStarted: toNumber(operations?.paymentStarted),
    purchaseConfirmed: toNumber(operations?.purchaseConfirmed),
  };

  return {
    totals,
    sessionConversion: ratio(totals.purchaseConfirmed, totals.sessions),
    checkoutConversion: ratio(totals.purchaseConfirmed, totals.checkoutStarted),
    topViewed: viewed,
    topClicked: clicked,
    topSold: sold,
    daily: dailyRows.map((row) => ({ day: row.day, pageViews: toNumber(row.pageViews), sessions: toNumber(row.sessions) })),
    devices: deviceRows.map((row) => ({ device: row.device, sessions: toNumber(row.sessions) })),
  };
}
