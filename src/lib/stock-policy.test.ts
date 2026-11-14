import { describe, expect, it } from "vitest";
import {
  findStockInconsistencies,
  getStandardStockLevel,
  isCriticalStockState,
  isStockPolicy,
  summarizeProductStock,
  type ProductStockInput,
} from "@/lib/stock-policy";

const unique = (overrides: Partial<ProductStockInput> = {}): ProductStockInput => ({
  policy: "UNIQUE",
  active: true,
  variants: [{ active: true, stock: 1, reservedStock: 0 }],
  soldUnits: 0,
  openReservedUnits: 0,
  openReservationOrders: 0,
  ...overrides,
});

const standard = (available: number, overrides: Partial<ProductStockInput> = {}): ProductStockInput => ({
  policy: "STANDARD",
  active: true,
  variants: [{ active: true, stock: available, reservedStock: 0 }],
  soldUnits: 0,
  openReservedUnits: 0,
  openReservationOrders: 0,
  ...overrides,
});

describe("stock policy", () => {
  it("only knows the two policies", () => {
    expect(isStockPolicy("UNIQUE")).toBe(true);
    expect(isStockPolicy("STANDARD")).toBe(true);
    expect(isStockPolicy("unique")).toBe(false);
    expect(isStockPolicy(undefined)).toBe(false);
  });

  describe("UNIQUE", () => {
    it("one unit on the shelf is the normal state, never low or critical", () => {
      const summary = summarizeProductStock(unique());
      expect(summary.state).toBe("available");
      expect(summary.inconsistencies).toEqual([]);
      expect(isCriticalStockState(summary.state)).toBe(false);
    });

    it("zero after a sale is sold, never critical", () => {
      const summary = summarizeProductStock(unique({ variants: [{ active: true, stock: 0, reservedStock: 0 }], soldUnits: 1 }));
      expect(summary.state).toBe("sold");
      expect(isCriticalStockState(summary.state)).toBe(false);
    });

    it("the unit held by an open checkout is reserved", () => {
      const summary = summarizeProductStock(unique({ variants: [{ active: true, stock: 1, reservedStock: 1 }], openReservedUnits: 1, openReservationOrders: 1 }));
      expect(summary.state).toBe("reserved");
      expect(isCriticalStockState(summary.state)).toBe(false);
    });

    it("zero units without a sale is sold out, not critical", () => {
      const summary = summarizeProductStock(unique({ variants: [{ active: true, stock: 0, reservedStock: 0 }] }));
      expect(summary.state).toBe("sold_out");
      expect(isCriticalStockState(summary.state)).toBe(false);
    });

    it("a refunded sale puts the piece back without an inconsistency", () => {
      // The refunded order no longer counts as sold; the unit is back on the shelf.
      expect(summarizeProductStock(unique({ soldUnits: 0 })).state).toBe("available");
    });

    it.each([
      ["negative stock", unique({ variants: [{ active: true, stock: -1, reservedStock: 0 }] }), "negative_stock"],
      ["negative reservation", unique({ variants: [{ active: true, stock: 1, reservedStock: -1 }], openReservedUnits: -1 }), "negative_reserved"],
      ["reservation above the physical unit", unique({ variants: [{ active: true, stock: 0, reservedStock: 1 }], openReservedUnits: 1, openReservationOrders: 1 }), "reserved_exceeds_stock"],
      ["double sale", unique({ variants: [{ active: true, stock: 0, reservedStock: 0 }], soldUnits: 2 }), "unique_double_sale"],
      ["double reservation by quantity", unique({ variants: [{ active: true, stock: 2, reservedStock: 2 }], openReservedUnits: 2, openReservationOrders: 1 }), "unique_double_reservation"],
      ["double reservation by orders", unique({ variants: [{ active: true, stock: 1, reservedStock: 1 }], openReservedUnits: 1, openReservationOrders: 2 }), "unique_double_reservation"],
      ["sold but still purchasable", unique({ soldUnits: 1 }), "unique_sold_but_purchasable"],
      ["sold with a unit left on a hidden product", unique({ soldUnits: 1, active: false }), "unique_sold_with_stock"],
      ["reservation that no open order explains", unique({ variants: [{ active: true, stock: 1, reservedStock: 1 }], openReservedUnits: 0 }), "reservation_mismatch"],
      ["open order without its reservation", unique({ openReservedUnits: 1, openReservationOrders: 1 }), "reservation_mismatch"],
      ["more than one unit", unique({ variants: [{ active: true, stock: 2, reservedStock: 0 }] }), "unique_multiple_units"],
    ] as const)("is inconsistent (critical) on %s", (_name, input, expected) => {
      const summary = summarizeProductStock(input);
      expect(summary.inconsistencies).toContain(expected);
      expect(summary.state).toBe("inconsistent");
      expect(isCriticalStockState(summary.state)).toBe(true);
    });

    it("does not count the stock of a deactivated size as a second unit", () => {
      const summary = summarizeProductStock(unique({ variants: [{ active: false, stock: 1, reservedStock: 0 }, { active: true, stock: 1, reservedStock: 0 }] }));
      expect(summary.physical).toBe(1);
      expect(summary.state).toBe("available");
    });
  });

  describe("STANDARD", () => {
    it("keeps the quantity levels: normal, low, critical, sold out", () => {
      expect(getStandardStockLevel(4)).toBe("available");
      expect(getStandardStockLevel(3)).toBe("low");
      expect(getStandardStockLevel(2)).toBe("low");
      expect(getStandardStockLevel(1)).toBe("critical");
      expect(getStandardStockLevel(0)).toBe("sold_out");
      expect(getStandardStockLevel(-2)).toBe("sold_out");
    });

    it("classifies a product by what a shopper can buy now", () => {
      expect(summarizeProductStock(standard(10)).state).toBe("available");
      expect(summarizeProductStock(standard(1)).state).toBe("critical");
      expect(summarizeProductStock(standard(5, { variants: [{ active: true, stock: 5, reservedStock: 3 }], openReservedUnits: 3 })).state).toBe("low");
      expect(summarizeProductStock(standard(0)).state).toBe("sold_out");
    });

    it("many sales and many reservations are normal for a replenishable item", () => {
      const summary = summarizeProductStock(standard(9, { variants: [{ active: true, stock: 12, reservedStock: 3 }], soldUnits: 40, openReservedUnits: 3, openReservationOrders: 3 }));
      expect(summary.inconsistencies).toEqual([]);
      expect(summary.state).toBe("available");
    });

    it("is inconsistent when the numbers contradict each other, whatever the quantity", () => {
      expect(findStockInconsistencies(standard(10, { variants: [{ active: true, stock: 10, reservedStock: 11 }], openReservedUnits: 11 }))).toContain("reserved_exceeds_stock");
      expect(findStockInconsistencies(standard(10, { openReservedUnits: 2 }))).toEqual(["reservation_mismatch"]);
      expect(summarizeProductStock(standard(10, { variants: [{ active: true, stock: -1, reservedStock: 0 }] })).state).toBe("inconsistent");
    });

    it("skips the reservation check when the open orders are unknown", () => {
      const summary = summarizeProductStock({ policy: "STANDARD", active: true, variants: [{ active: true, stock: 5, reservedStock: 2 }] });
      expect(summary.inconsistencies).toEqual([]);
    });
  });
});
