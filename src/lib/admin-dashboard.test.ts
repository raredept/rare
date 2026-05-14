import { describe, expect, it } from "vitest";
import { buildOrderFlowCounts, calculateDashboardKpis } from "@/lib/admin-dashboard";

describe("admin dashboard helpers", () => {
  it("calculates operational KPIs from orders and inventory", () => {
    const now = new Date("2026-05-12T12:00:00Z");
    const kpis = calculateDashboardKpis({
      now,
      activeProducts: 4,
      soldOutProducts: 1,
      customers: 3,
      orders: [
        { status: "paid", totalInCents: 10000, createdAt: new Date("2026-05-11T12:00:00Z") },
        { status: "shipped", totalInCents: 20000, createdAt: new Date("2026-04-20T12:00:00Z") },
        { status: "awaiting_payment", totalInCents: 15000, createdAt: now },
        { status: "failed", totalInCents: 15000, createdAt: now },
      ],
      variants: [
        { active: true, stock: 3, reservedStock: 1 },
        { active: true, stock: 0, reservedStock: 0 },
        { active: false, stock: 1, reservedStock: 0 },
      ],
    });

    expect(kpis.revenueTotalInCents).toBe(30000);
    expect(kpis.revenue7DaysInCents).toBe(10000);
    expect(kpis.paidOrders).toBe(2);
    expect(kpis.pendingOrders).toBe(1);
    expect(kpis.failedOrders).toBe(1);
    expect(kpis.averageTicketInCents).toBe(15000);
    expect(kpis.lowStockVariants).toBe(1);
    expect(kpis.soldOutProducts).toBe(1);
    expect(kpis.customers).toBe(3);
  });

  it("does not count canceled, failed or refunded orders as revenue", () => {
    const kpis = calculateDashboardKpis({
      activeProducts: 0,
      customers: 0,
      orders: [
        { status: "paid", totalInCents: 10000, createdAt: new Date() },
        { status: "canceled", totalInCents: 20000, createdAt: new Date() },
        { status: "failed", totalInCents: 30000, createdAt: new Date() },
        { status: "refunded", totalInCents: 40000, createdAt: new Date() },
      ],
      variants: [],
    });

    expect(kpis.revenueTotalInCents).toBe(10000);
    expect(kpis.averageTicketInCents).toBe(10000);
    expect(kpis.failedOrders).toBe(3);
  });

  it("builds order flow counts by status", () => {
    const flow = buildOrderFlowCounts([
      { status: "paid", totalInCents: 100, createdAt: new Date() },
      { status: "paid", totalInCents: 100, createdAt: new Date() },
      { status: "canceled", totalInCents: 100, createdAt: new Date() },
    ]);

    expect(flow.paid).toBe(2);
    expect(flow.canceled).toBe(1);
    expect(flow.awaiting_payment).toBe(0);
  });
});
