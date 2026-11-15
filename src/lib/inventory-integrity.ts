import { paidRevenueStatuses } from "@/lib/order-display";
import { releasableReservationStatuses } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import {
  isStockPolicy,
  STOCK_INCONSISTENCY_LABELS,
  summarizeProductStock,
  type ProductStockSummary,
  type StockInconsistency,
  type StockPolicy,
  type StockState,
  type StockVariantInput,
} from "@/lib/stock-policy";

// Inventory integrity: what the numbers must agree on, whatever the quantity. Read in ONE statement
// so variants, reservations and sales come from the same snapshot (two queries could straddle a
// checkout and report a reservation that "does not match" for a few milliseconds).

export type ProductStockSnapshot = {
  productId: string;
  title: string;
  active: boolean;
  policy: StockPolicy;
  variants: StockVariantInput[];
  soldUnits: number;
  openReservedUnits: number;
  openReservationOrders: number;
};

export type ProductStockReportEntry = ProductStockSummary & {
  productId: string;
  title: string;
  active: boolean;
  soldUnits: number;
  inconsistencyLabels: string[];
};

export type InventoryIntegrityReport = {
  products: ProductStockReportEntry[];
  inconsistent: ProductStockReportEntry[];
  countsByState: Record<StockState, number>;
  countsByPolicy: Record<StockPolicy, number>;
};

type RawSnapshotRow = {
  productId: string;
  title: string;
  active: boolean;
  stockPolicy: string;
  variants: unknown;
  soldUnits: unknown;
  openReservedUnits: unknown;
  openReservationOrders: unknown;
};

function toInt(value: unknown) {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toVariants(value: unknown): StockVariantInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    return [{ active: row.active === true, stock: toInt(row.stock), reservedStock: toInt(row.reservedStock) }];
  });
}

export async function getProductStockSnapshots(productIds?: string[]): Promise<ProductStockSnapshot[]> {
  if (productIds && !productIds.length) return [];
  const ids = productIds ?? null;
  const rows = await prisma.$queryRaw<RawSnapshotRow[]>`
    SELECT
      "p"."id" AS "productId", "p"."title", "p"."active", "p"."stockPolicy"::text AS "stockPolicy",
      COALESCE("v"."variants", '[]'::json) AS "variants",
      COALESCE("o"."soldUnits", 0)::int AS "soldUnits",
      COALESCE("o"."openReservedUnits", 0)::int AS "openReservedUnits",
      COALESCE("o"."openReservationOrders", 0)::int AS "openReservationOrders"
    FROM "Product" "p"
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('active', "x"."active", 'stock', "x"."stock", 'reservedStock', "x"."reservedStock")) AS "variants"
      FROM "ProductVariant" "x"
      WHERE "x"."productId" = "p"."id"
    ) "v" ON true
    LEFT JOIN (
      SELECT "oi"."productId",
        COALESCE(SUM("oi"."quantity") FILTER (WHERE "ord"."status" = ANY(${paidRevenueStatuses}::"OrderStatus"[])), 0) AS "soldUnits",
        COALESCE(SUM("oi"."quantity") FILTER (WHERE "ord"."status" = ANY(${releasableReservationStatuses}::"OrderStatus"[])), 0) AS "openReservedUnits",
        COUNT(DISTINCT "ord"."id") FILTER (WHERE "ord"."status" = ANY(${releasableReservationStatuses}::"OrderStatus"[])) AS "openReservationOrders"
      FROM "OrderItem" "oi"
      JOIN "Order" "ord" ON "ord"."id" = "oi"."orderId"
      WHERE "oi"."productId" IS NOT NULL
      GROUP BY "oi"."productId"
    ) "o" ON "o"."productId" = "p"."id"
    WHERE (${ids}::text[] IS NULL OR "p"."id" = ANY(${ids}::text[]))
    ORDER BY "p"."title" ASC, "p"."id" ASC
  `;

  return rows.map((row) => ({
    productId: row.productId,
    title: row.title,
    active: row.active,
    policy: isStockPolicy(row.stockPolicy) ? row.stockPolicy : "STANDARD",
    variants: toVariants(row.variants),
    soldUnits: toInt(row.soldUnits),
    openReservedUnits: toInt(row.openReservedUnits),
    openReservationOrders: toInt(row.openReservationOrders),
  }));
}

export function describeStockInconsistencies(inconsistencies: StockInconsistency[]) {
  return inconsistencies.map((code) => STOCK_INCONSISTENCY_LABELS[code]);
}

export function buildInventoryIntegrityReport(snapshots: ProductStockSnapshot[]): InventoryIntegrityReport {
  const countsByState: Record<StockState, number> = { available: 0, low: 0, critical: 0, reserved: 0, sold: 0, sold_out: 0, inconsistent: 0 };
  const countsByPolicy: Record<StockPolicy, number> = { STANDARD: 0, UNIQUE: 0 };
  const products = snapshots.map((snapshot): ProductStockReportEntry => {
    const summary = summarizeProductStock(snapshot);
    countsByState[summary.state] += 1;
    countsByPolicy[snapshot.policy] += 1;
    return {
      ...summary,
      productId: snapshot.productId,
      title: snapshot.title,
      active: snapshot.active,
      soldUnits: snapshot.soldUnits,
      inconsistencyLabels: describeStockInconsistencies(summary.inconsistencies),
    };
  });

  return { products, inconsistent: products.filter((product) => product.state === "inconsistent"), countsByState, countsByPolicy };
}

export async function getInventoryIntegrityReport(productIds?: string[]) {
  return buildInventoryIntegrityReport(await getProductStockSnapshots(productIds));
}
