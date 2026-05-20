import type { OrderStatus } from "@prisma/client";
import { isPaidRevenueStatus } from "@/lib/order-display";

export type DashboardOrderInput = {
  status: OrderStatus;
  totalInCents: number;
  createdAt: Date;
};

export type DashboardVariantInput = {
  stock: number;
  reservedStock: number;
  active: boolean;
};

const orderFlowStatusOrder: OrderStatus[] = [
  "pending",
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "canceled",
  "refunded",
  "failed",
];

export function getDateDaysAgo(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

export function calculateDashboardKpis({
  orders,
  variants,
  activeProducts,
  soldOutProducts,
  customers,
  now = new Date(),
}: {
  orders: DashboardOrderInput[];
  variants: DashboardVariantInput[];
  activeProducts: number;
  soldOutProducts?: number;
  customers: number;
  now?: Date;
}) {
  const sevenDaysAgo = getDateDaysAgo(7, now);
  const thirtyDaysAgo = getDateDaysAgo(30, now);
  const paidOrders = orders.filter((order) => isPaidRevenueStatus(order.status));
  const pendingOrders = orders.filter((order) => order.status === "pending" || order.status === "awaiting_payment");
  const failedOrders = orders.filter((order) => order.status === "canceled" || order.status === "failed" || order.status === "refunded");
  const revenueTotalInCents = paidOrders.reduce((sum, order) => sum + order.totalInCents, 0);
  const revenue7DaysInCents = paidOrders
    .filter((order) => order.createdAt >= sevenDaysAgo)
    .reduce((sum, order) => sum + order.totalInCents, 0);
  const revenue30DaysInCents = paidOrders
    .filter((order) => order.createdAt >= thirtyDaysAgo)
    .reduce((sum, order) => sum + order.totalInCents, 0);
  const activeVariants = variants.filter((variant) => variant.active);
  const lowStockVariants = activeVariants.filter((variant) => variant.stock - variant.reservedStock > 0 && variant.stock - variant.reservedStock <= 3);
  const soldOutVariants = activeVariants.filter((variant) => variant.stock - variant.reservedStock <= 0);

  return {
    revenueTotalInCents,
    revenue7DaysInCents,
    revenue30DaysInCents,
    ordersTotal: orders.length,
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    failedOrders: failedOrders.length,
    averageTicketInCents: paidOrders.length ? Math.round(revenueTotalInCents / paidOrders.length) : 0,
    activeProducts,
    soldOutProducts: soldOutProducts ?? soldOutVariants.length,
    lowStockVariants: lowStockVariants.length,
    customers,
  };
}

export function buildOrderFlowCounts(orders: DashboardOrderInput[]) {
  const flow: Record<OrderStatus, number> = {
    pending: 0,
    awaiting_payment: 0,
    paid: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    canceled: 0,
    refunded: 0,
    failed: 0,
  };

  for (const order of orders) {
    flow[order.status] += 1;
  }

  return flow;
}

export function getSortedOrderFlowEntries(flow: Record<OrderStatus, number>) {
  const fallbackOrder = new Map(orderFlowStatusOrder.map((status, index) => [status, index]));

  return Object.entries(flow)
    .map(([status, count]) => [status as OrderStatus, count] as const)
    .sort((first, second) => second[1] - first[1] || (fallbackOrder.get(first[0]) ?? 999) - (fallbackOrder.get(second[0]) ?? 999));
}
