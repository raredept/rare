import type { OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canTransitionManually, getManualStatusOptions, manualStatusTransitions } from "@/lib/order-status";

const allStatuses = Object.keys(manualStatusTransitions) as OrderStatus[];

describe("manual order status transitions", () => {
  it("never leaves a closed order", () => {
    for (const closed of ["canceled", "failed", "refunded"] as OrderStatus[]) {
      expect(getManualStatusOptions(closed)).toEqual([]);
    }
  });

  it("does not let an Admin mark an order as paid or expired by hand", () => {
    for (const from of allStatuses) {
      expect(canTransitionManually(from, "paid")).toBe(false);
      expect(canTransitionManually(from, "awaiting_payment")).toBe(false);
      expect(canTransitionManually(from, "failed")).toBe(false);
    }
  });

  it("only cancels orders that were never paid, so stock is released exactly once", () => {
    expect(canTransitionManually("awaiting_payment", "canceled")).toBe(true);
    expect(canTransitionManually("pending", "canceled")).toBe(true);
    for (const paid of ["paid", "processing", "shipped", "delivered"] as OrderStatus[]) {
      expect(canTransitionManually(paid, "canceled")).toBe(false);
    }
  });

  it("follows the fulfilment path forward only", () => {
    expect(canTransitionManually("paid", "processing")).toBe(true);
    expect(canTransitionManually("processing", "shipped")).toBe(true);
    expect(canTransitionManually("shipped", "delivered")).toBe(true);
    expect(canTransitionManually("delivered", "shipped")).toBe(false);
    expect(canTransitionManually("shipped", "processing")).toBe(false);
    expect(canTransitionManually("canceled", "shipped")).toBe(false);
  });

  it("allows a refund only after payment", () => {
    for (const from of ["paid", "processing", "shipped", "delivered"] as OrderStatus[]) expect(canTransitionManually(from, "refunded")).toBe(true);
    for (const from of ["pending", "awaiting_payment", "canceled", "failed"] as OrderStatus[]) expect(canTransitionManually(from, "refunded")).toBe(false);
  });

  it("does not allow a no-op change", () => {
    for (const status of allStatuses) expect(canTransitionManually(status, status)).toBe(false);
  });
});
