import { describe, expect, it } from "vitest";
import {
  computePromotionDiscount,
  getEffectivePromotionStatus,
  MIN_PROMOTIONAL_PRICE_IN_CENTS,
  priceProduct,
  type PromotionRule,
} from "@/lib/promotions/engine";

const now = new Date("2026-11-27T15:00:00Z");
const product = { id: "p1", priceInCents: 20000, categoryId: "cat_shirts", subcategoryId: "sub_oversized" };

function rule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: "promo_1", name: "Black Friday", slug: "black-friday", status: "ACTIVE", type: "PERCENTAGE", value: 25, scope: "ALL_PRODUCTS",
    startsAt: null, endsAt: null, priority: 0, createdAt: new Date("2026-11-01T00:00:00Z"), badgeText: "BF",
    productIds: new Set(), categoryIds: new Set(), ...overrides,
  };
}

describe("effective status", () => {
  it.each([
    ["DRAFT", null, null, "DRAFT"],
    ["PAUSED", null, null, "PAUSED"],
    ["ENDED", null, null, "ENDED"],
    ["ACTIVE", null, null, "ACTIVE"],
    ["ACTIVE", "2026-11-28T03:00:00Z", null, "SCHEDULED"],
    ["SCHEDULED", "2026-11-27T14:59:59Z", null, "ACTIVE"],
    ["ACTIVE", null, "2026-11-27T15:00:00Z", "ENDED"],
    ["ACTIVE", null, "2026-11-27T15:00:01Z", "ACTIVE"],
  ] as const)("%s start=%s end=%s -> %s", (status, startsAt, endsAt, expected) => {
    expect(getEffectivePromotionStatus({ status, startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null }, now)).toBe(expected);
  });

  it("starts exactly at startsAt and stops exactly at endsAt (no deploy, no job)", () => {
    const start = new Date("2026-11-27T03:00:00Z");
    const end = new Date("2026-11-30T02:59:59Z");
    const promo = rule({ startsAt: start, endsAt: end });
    expect(priceProduct([promo], product, new Date(start.getTime() - 1)).promotion).toBeNull();
    expect(priceProduct([promo], product, start).promotion?.id).toBe("promo_1");
    expect(priceProduct([promo], product, new Date(end.getTime() - 1)).promotion?.id).toBe("promo_1");
    expect(priceProduct([promo], product, end).promotion).toBeNull();
  });

  it("never applies draft, paused or ended promotions", () => {
    for (const status of ["DRAFT", "PAUSED", "ENDED"] as const) {
      expect(priceProduct([rule({ status })], product, now).finalPriceInCents).toBe(20000);
    }
  });
});

describe("discount computation", () => {
  it("computes percentages and fixed amounts in integer cents", () => {
    expect(computePromotionDiscount({ type: "PERCENTAGE", value: 25 }, 20000)).toBe(5000);
    expect(computePromotionDiscount({ type: "PERCENTAGE", value: 33 }, 19990)).toBe(6596);
    expect(computePromotionDiscount({ type: "FIXED_AMOUNT", value: 3000 }, 20000)).toBe(3000);
  });

  it("refuses rules that would be negative, above 100% or push the price under the floor", () => {
    expect(computePromotionDiscount({ type: "PERCENTAGE", value: -10 }, 20000)).toBeNull();
    expect(computePromotionDiscount({ type: "PERCENTAGE", value: 101 }, 20000)).toBeNull();
    expect(computePromotionDiscount({ type: "PERCENTAGE", value: 100 }, 20000)).toBeNull();
    expect(computePromotionDiscount({ type: "FIXED_AMOUNT", value: 20000 }, 20000)).toBeNull();
    expect(computePromotionDiscount({ type: "FIXED_AMOUNT", value: 20000 - MIN_PROMOTIONAL_PRICE_IN_CENTS }, 20000)).toBe(19900);
    expect(computePromotionDiscount({ type: "FIXED_AMOUNT", value: null }, 20000)).toBeNull();
    expect(computePromotionDiscount({ type: "FIXED_AMOUNT", value: 1.5 }, 20000)).toBeNull();
  });

  it("reports the calculated percentage, never a configured label", () => {
    const price = priceProduct([rule({ type: "FIXED_AMOUNT", value: 5010 })], { ...product, priceInCents: 19990 }, now);
    expect(price).toMatchObject({ basePriceInCents: 19990, finalPriceInCents: 14980, discountInCents: 5010, percentOff: 25 });
  });
});

describe("scope", () => {
  it("targets selected products only", () => {
    const promo = rule({ scope: "SELECTED_PRODUCTS", productIds: new Set(["p2"]) });
    expect(priceProduct([promo], product, now).promotion).toBeNull();
    expect(priceProduct([promo], { ...product, id: "p2" }, now).promotion?.id).toBe("promo_1");
  });

  it("targets a category through the product's category or subcategory", () => {
    expect(priceProduct([rule({ scope: "SELECTED_CATEGORIES", categoryIds: new Set(["cat_shirts"]) })], product, now).promotion).not.toBeNull();
    expect(priceProduct([rule({ scope: "SELECTED_CATEGORIES", categoryIds: new Set(["sub_oversized"]) })], product, now).promotion).not.toBeNull();
    expect(priceProduct([rule({ scope: "SELECTED_CATEGORIES", categoryIds: new Set(["cat_bags"]) })], product, now).promotion).toBeNull();
  });
});

describe("stacking and priority", () => {
  it("applies exactly one promotion per item, never the sum", () => {
    const price = priceProduct([rule({ id: "a", value: 10 }), rule({ id: "b", value: 20 })], product, now);
    expect(price.discountInCents).toBe(4000);
    expect(price.finalPriceInCents).toBe(16000);
  });

  it("prefers higher priority even with a smaller discount", () => {
    const price = priceProduct([rule({ id: "big", value: 50, priority: 0 }), rule({ id: "vip", value: 10, priority: 5 })], product, now);
    expect(price.promotion?.id).toBe("vip");
  });

  it("breaks ties by larger discount, then by the older promotion, then by id", () => {
    expect(priceProduct([rule({ id: "a", value: 10 }), rule({ id: "b", value: 15 })], product, now).promotion?.id).toBe("b");
    expect(priceProduct([
      rule({ id: "new", createdAt: new Date("2026-11-10T00:00:00Z") }),
      rule({ id: "old", createdAt: new Date("2026-11-02T00:00:00Z") }),
    ], product, now).promotion?.id).toBe("old");
    expect(priceProduct([rule({ id: "b" }), rule({ id: "a" })], product, now).promotion?.id).toBe("a");
  });

  it("falls back to the next valid rule when the winner cannot apply to this price", () => {
    const price = priceProduct([rule({ id: "too-much", type: "FIXED_AMOUNT", value: 50000, priority: 9 }), rule({ id: "ok", value: 10 })], product, now);
    expect(price.promotion?.id).toBe("ok");
  });
});
