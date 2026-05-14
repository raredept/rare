import { describe, expect, it } from "vitest";
import { getAvailableStock, isVariantPurchasable } from "@/lib/stock";

describe("stock helpers", () => {
  it("subtracts temporary reservations from visible stock", () => {
    expect(getAvailableStock(5, 2)).toBe(3);
    expect(getAvailableStock(1, 3)).toBe(0);
  });

  it("requires active variant and enough available stock", () => {
    expect(isVariantPurchasable({ active: true, stock: 5, reservedStock: 1 }, 4)).toBe(true);
    expect(isVariantPurchasable({ active: true, stock: 5, reservedStock: 1 }, 5)).toBe(false);
    expect(isVariantPurchasable({ active: false, stock: 5, reservedStock: 0 }, 1)).toBe(false);
  });
});
