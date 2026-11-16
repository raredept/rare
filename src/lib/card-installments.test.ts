import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS,
  ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS,
  calculateCardInstallmentPlan,
  calculateSurchargeInCents,
  CARD_INSTALLMENTS_INTEREST_FREE,
  CARD_INSTALLMENTS_MAX,
  CardInstallmentError,
  describeCardInstallmentPlan,
  DISABLED_CARD_INSTALLMENT_RULES,
  EMPTY_SURCHARGE_TABLE,
  formatBpsAsPercent,
  listCardInstallmentPlans,
  maxInterestFreeInstallments,
  maxOfferedInstallments,
  parsePercentToBps,
  parseSurchargeTable,
  resolveCardInstallmentRules,
  type CardInstallmentRules,
} from "@/lib/card-installments";

const rules: CardInstallmentRules = {
  enabled: true,
  maxInstallments: 12,
  minInstallmentInCents: 1_000,
  surchargeBps: APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS,
};

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof CardInstallmentError ? error.code : "OTHER";
  }
  return "NO_ERROR";
};

// The owner-approved policy (2026-11-16). If any rate here changes without an explicit decision,
// this test must fail.
const APPROVED_PERCENT: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 9, 5: 10, 6: 11, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18 };

describe("approved policy (regression lock)", () => {
  it("is 1x-12x, interest-free up to 3x", () => {
    expect(CARD_INSTALLMENTS_MAX).toBe(12);
    expect(CARD_INSTALLMENTS_INTEREST_FREE).toBe(3);
  });

  it("pins every surcharge of the approved table", () => {
    expect(APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS).toEqual({ 4: 900, 5: 1_000, 6: 1_100, 7: 1_300, 8: 1_400, 9: 1_500, 10: 1_600, 11: 1_700, 12: 1_800 });
  });

  it("the migration seeds exactly the approved table, off by default, maximum 12x", () => {
    const sql = readFileSync(path.join(process.cwd(), "prisma/migrations/20261116180000_card_installments/migration.sql"), "utf8");
    expect(sql).toContain(`DEFAULT '${JSON.stringify(Object.fromEntries(Object.entries(APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS)))}'`);
    expect(sql).toMatch(/"cardInstallmentsEnabled" BOOLEAN NOT NULL DEFAULT false/);
    expect(sql).toMatch(/"cardInstallmentsMax" INTEGER NOT NULL DEFAULT 12/);
  });
});

describe("calculateCardInstallmentPlan — every count of the approved table on R$ 600,00", () => {
  it.each(Object.entries(APPROVED_PERCENT).map(([count, percent]) => [Number(count), percent]))("%ix = %i%%", (count, percent) => {
    const plan = calculateCardInstallmentPlan(60_000, count, rules);
    const fee = (60_000 * percent) / 100; // exact for R$ 600
    expect(plan).toMatchObject({ installmentCount: count, rateBps: percent * 100, baseTotalInCents: 60_000, feeInCents: fee, financedTotalInCents: 60_000 + fee, interestFree: percent === 0 });
    expect(plan.installmentValueInCents * (count - 1) + plan.lastInstallmentValueInCents).toBe(plan.financedTotalInCents);
  });

  it("1x is today's card flow even with installments disabled", () => {
    expect(calculateCardInstallmentPlan(1_234, 1, DISABLED_CARD_INSTALLMENT_RULES)).toMatchObject({ installmentCount: 1, feeInCents: 0, financedTotalInCents: 1_234 });
  });
});

describe("rounding in integer cents (7x, 9x, 11x, 12x with totals that do not divide)", () => {
  it.each([
    // base, count, fee (half up), financed, each, last
    [59_990, 7, 7_799, 67_789, 9_684, 9_685],
    [59_990, 9, 8_999, 68_989, 7_665, 7_669],
    [59_990, 11, 10_198, 70_188, 6_380, 6_388],
    [59_990, 12, 10_798, 70_788, 5_899, 5_899],
    [12_345, 12, 2_222, 14_567, 1_213, 1_224],
    [33_333, 11, 5_667, 39_000, 3_545, 3_550],
  ])("base %i in %ix: fee %i, total %i, %i x n-1 + %i", (base, count, fee, total, each, last) => {
    const plan = calculateCardInstallmentPlan(base, count, rules);
    expect(plan).toMatchObject({ feeInCents: fee, financedTotalInCents: total, installmentValueInCents: each, lastInstallmentValueInCents: last });
    // No cent lost or created: the sum of the installments is exactly the total sent to Asaas.
    expect(each * (count - 1) + last).toBe(total);
    expect(total).toBe(base + fee);
  });

  it("rounds the surcharge half up (no 199.90 * 1.07 float drift)", () => {
    expect(calculateSurchargeInCents(19_990, 700)).toBe(1_399);
    expect(calculateSurchargeInCents(19_995, 700)).toBe(1_400);
    expect(calculateSurchargeInCents(1_250, 4)).toBe(1);
    expect(calculateSurchargeInCents(1_249, 4)).toBe(0);
  });

  it("follows the business order: products - coupon + shipping = base, then the surcharge", () => {
    const base = 50_000 - 5_000 + 3_000; // R$ 500 - RARE10 + R$ 30 frete = R$ 480
    expect(calculateCardInstallmentPlan(base, 12, rules)).toMatchObject({ baseTotalInCents: 48_000, feeInCents: 8_640, financedTotalInCents: 56_640, installmentValueInCents: 4_720 });
  });
});

describe("what is never offered", () => {
  it.each([13, 0, -1, 999, 1.5, Number.NaN])("rejects installmentCount=%s", (count) => {
    expect(code(() => calculateCardInstallmentPlan(600_000, count, rules))).toBe("INVALID_COUNT");
  });

  it("never offers 13x or more, whatever the stored maximum", () => {
    expect(listCardInstallmentPlans(6_000_000, { ...rules, maxInstallments: 21 }).map((plan) => plan.installmentCount)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("rejects 2x+ when installments are disabled", () => {
    expect(code(() => calculateCardInstallmentPlan(60_000, 2, DISABLED_CARD_INSTALLMENT_RULES))).toBe("DISABLED");
  });

  it("rejects counts above the Admin maximum, without a rate, or after a hole", () => {
    expect(code(() => calculateCardInstallmentPlan(60_000, 7, { ...rules, maxInstallments: 6 }))).toBe("COUNT_NOT_OFFERED");
    const hole = { ...rules, surchargeBps: { ...APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS, 9: null } };
    expect(code(() => calculateCardInstallmentPlan(600_000, 9, hole))).toBe("COUNT_NOT_OFFERED");
    expect(code(() => calculateCardInstallmentPlan(600_000, 12, hole))).toBe("COUNT_NOT_OFFERED");
    expect(calculateCardInstallmentPlan(600_000, 8, hole).installmentCount).toBe(8);
  });

  it("rejects an installment below the store minimum or below the Asaas minimum", () => {
    expect(code(() => calculateCardInstallmentPlan(2_000, 3, rules))).toBe("BELOW_MINIMUM_INSTALLMENT");
    const loose = { ...rules, minInstallmentInCents: 1 };
    expect(code(() => calculateCardInstallmentPlan(1_400, 3, loose))).toBe("BELOW_MINIMUM_INSTALLMENT");
    expect(calculateCardInstallmentPlan(1_500, 3, loose).installmentValueInCents).toBe(ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS);
  });

  it("lists only the counts the total allows: R$ 50,00 with a R$ 10 minimum -> up to 5x", () => {
    // 5x of R$ 55,00 = R$ 11,00 >= R$ 10; 6x of R$ 55,50 = R$ 9,25 < R$ 10.
    expect(listCardInstallmentPlans(5_000, rules).map((plan) => plan.installmentCount)).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects a non-positive base", () => {
    expect(code(() => calculateCardInstallmentPlan(0, 1, rules))).toBe("INVALID_BASE");
  });
});

describe("rules from the flag and the Admin settings", () => {
  const stored = { cardInstallmentsEnabled: true, cardInstallmentsMax: 12, cardInstallmentsMinInCents: 1_000, cardInstallmentSurchargesBps: { 4: 900, 5: 1_000, 6: 1_100, 7: 1_300, 8: 1_400, 9: 1_500, 10: 1_600, 11: 1_700, 12: 1_800 } };

  it("needs BOTH the deploy flag and the Admin toggle", () => {
    expect(resolveCardInstallmentRules(false, stored).enabled).toBe(false);
    expect(resolveCardInstallmentRules(true, { ...stored, cardInstallmentsEnabled: false }).enabled).toBe(false);
    expect(resolveCardInstallmentRules(true, stored)).toEqual(rules);
  });

  it("treats invalid stored values as not offered instead of trusting them", () => {
    const resolved = resolveCardInstallmentRules(true, { ...stored, cardInstallmentsMax: 13, cardInstallmentsMinInCents: 100, cardInstallmentSurchargesBps: { 4: 900, 5: 9_999, 6: "11", 7: -1, 8: 1.5, 13: 100 } });
    expect(resolved.maxInstallments).toBe(1);
    expect(resolved.minInstallmentInCents).toBe(1_000);
    expect(resolved.surchargeBps).toEqual({ ...EMPTY_SURCHARGE_TABLE, 4: 900 });
    expect(parseSurchargeTable(null)).toEqual(EMPTY_SURCHARGE_TABLE);
    expect(parseSurchargeTable([900])).toEqual(EMPTY_SURCHARGE_TABLE);
  });

  it("short copy: interest-free and overall maximum", () => {
    expect(maxOfferedInstallments(rules)).toBe(12);
    expect(maxInterestFreeInstallments(rules)).toBe(3);
    expect(maxOfferedInstallments({ ...rules, surchargeBps: EMPTY_SURCHARGE_TABLE })).toBe(3);
    expect(maxOfferedInstallments(DISABLED_CARD_INSTALLMENT_RULES)).toBe(1);
  });
});

describe("display and Admin parsing", () => {
  const nb = (value: string) => value.replace(/ /g, " ");
  it("states interest-free plainly and always shows the final card total of surcharged plans", () => {
    expect(nb(describeCardInstallmentPlan(calculateCardInstallmentPlan(60_000, 3, rules)))).toBe("3x de R$ 200,00 sem juros");
    expect(nb(describeCardInstallmentPlan(calculateCardInstallmentPlan(60_000, 12, rules)))).toBe("12x de R$ 59,00 com acréscimo · Total no cartão R$ 708,00");
  });

  it("parses percentages to basis points and back", () => {
    expect(parsePercentToBps("9")).toBe(900);
    expect(parsePercentToBps("8,5")).toBe(850);
    expect(parsePercentToBps("8.25%")).toBe(825);
    expect(parsePercentToBps("")).toBeNull();
    expect(parsePercentToBps("abc")).toBeNaN();
    expect(parsePercentToBps("-1")).toBeNaN();
    expect(formatBpsAsPercent(850)).toBe("8,5%");
    expect(formatBpsAsPercent(1_800)).toBe("18%");
  });
});
