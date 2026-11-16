import { describe, expect, it } from "vitest";
import {
  ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS,
  calculateCardInstallmentPlan,
  calculateSurchargeInCents,
  CardInstallmentError,
  describeCardInstallmentPlan,
  DISABLED_CARD_INSTALLMENT_RULES,
  formatBpsAsPercent,
  listCardInstallmentPlans,
  maxInterestFreeInstallments,
  maxOfferedInstallments,
  parsePercentToBps,
  resolveCardInstallmentRules,
  type CardInstallmentRules,
} from "@/lib/card-installments";

const rules: CardInstallmentRules = {
  enabled: true,
  maxInstallments: 6,
  minInstallmentInCents: 1_000,
  surchargeBps: { 4: 600, 5: 750, 6: 900 },
};

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof CardInstallmentError ? error.code : "OTHER";
  }
  return "NO_ERROR";
};

describe("calculateCardInstallmentPlan — interest-free 1x to 3x", () => {
  it.each([
    [1, 60_000, 60_000],
    [2, 60_000, 30_000],
    [3, 60_000, 20_000],
  ])("%ix of R$ 600,00 has no surcharge", (count, base, each) => {
    const plan = calculateCardInstallmentPlan(base, count, rules);
    expect(plan).toMatchObject({ installmentCount: count, rateBps: 0, feeInCents: 0, financedTotalInCents: base, installmentValueInCents: each, interestFree: true });
  });

  it("1x is today's card flow even with installments disabled", () => {
    expect(calculateCardInstallmentPlan(1_234, 1, DISABLED_CARD_INSTALLMENT_RULES)).toMatchObject({ installmentCount: 1, feeInCents: 0, financedTotalInCents: 1_234 });
  });

  it("keeps interest-free even if a rate were stored for low counts (rates exist only for 4x-6x)", () => {
    expect(calculateCardInstallmentPlan(59_990, 3, rules)).toMatchObject({ feeInCents: 0, financedTotalInCents: 59_990, installmentValueInCents: 19_996, lastInstallmentValueInCents: 19_998 });
  });
});

describe("calculateCardInstallmentPlan — surcharge on 4x to 6x", () => {
  it.each([
    [4, 600, 3_600, 63_600, 15_900],
    [5, 750, 4_500, 64_500, 12_900],
    [6, 900, 5_400, 65_400, 10_900],
  ])("%ix: total surcharge %i bps over the base", (count, bps, fee, total, each) => {
    const plan = calculateCardInstallmentPlan(60_000, count, rules);
    expect(plan).toMatchObject({ installmentCount: count, rateBps: bps, baseTotalInCents: 60_000, feeInCents: fee, financedTotalInCents: total, installmentValueInCents: each, interestFree: false });
  });

  it("rounds the surcharge half up in integer cents (no 199.90 * 1.07 float drift)", () => {
    expect(calculateSurchargeInCents(19_990, 700)).toBe(1_399); // 1399.3
    expect(calculateSurchargeInCents(19_995, 700)).toBe(1_400); // 1399.65
    expect(calculateSurchargeInCents(1_250, 4)).toBe(1); // 0.5 -> 1
    expect(calculateSurchargeInCents(1_249, 4)).toBe(0); // 0.4996 -> 0
  });

  it("splits like Asaas: the rounding remainder goes to the last installment, and the sum is exact", () => {
    const plan = calculateCardInstallmentPlan(10_001, 4, { ...rules, surchargeBps: { 4: 0, 5: null, 6: null } });
    expect(plan).toMatchObject({ financedTotalInCents: 10_001, installmentValueInCents: 2_500, lastInstallmentValueInCents: 2_501 });
    expect(plan.installmentValueInCents * 3 + plan.lastInstallmentValueInCents).toBe(plan.financedTotalInCents);
  });

  it("follows the business order: products - coupon + shipping = base, then the surcharge", () => {
    // Produto R$ 500, RARE10 -R$ 50, frete R$ 30 -> base R$ 480; 6x at 9% -> +R$ 43,20.
    const base = 50_000 - 5_000 + 3_000;
    const plan = calculateCardInstallmentPlan(base, 6, rules);
    expect(plan).toMatchObject({ baseTotalInCents: 48_000, feeInCents: 4_320, financedTotalInCents: 52_320, installmentValueInCents: 8_720 });
  });
});

describe("calculateCardInstallmentPlan — what is never offered", () => {
  it.each([0, -1, 7, 999, 1.5, Number.NaN])("rejects installmentCount=%s", (count) => {
    expect(code(() => calculateCardInstallmentPlan(60_000, count, rules))).toBe("INVALID_COUNT");
  });

  it("never offers 7x or more, whatever the stored maximum", () => {
    expect(code(() => calculateCardInstallmentPlan(600_000, 7, { ...rules, maxInstallments: 21 }))).toBe("INVALID_COUNT");
    expect(listCardInstallmentPlans(600_000, { ...rules, maxInstallments: 21 }).map((plan) => plan.installmentCount)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("rejects 2x+ when installments are disabled", () => {
    expect(code(() => calculateCardInstallmentPlan(60_000, 2, DISABLED_CARD_INSTALLMENT_RULES))).toBe("DISABLED");
  });

  it("rejects counts above the Admin maximum and counts without a rate", () => {
    expect(code(() => calculateCardInstallmentPlan(60_000, 4, { ...rules, maxInstallments: 3 }))).toBe("COUNT_NOT_OFFERED");
    expect(code(() => calculateCardInstallmentPlan(60_000, 5, { ...rules, surchargeBps: { 4: 600, 5: null, 6: 900 } }))).toBe("COUNT_NOT_OFFERED");
    // No "hole": without 5x, 6x is not offered either.
    expect(code(() => calculateCardInstallmentPlan(60_000, 6, { ...rules, surchargeBps: { 4: 600, 5: null, 6: 900 } }))).toBe("COUNT_NOT_OFFERED");
  });

  it("rejects an installment below the store minimum or below the Asaas minimum", () => {
    expect(code(() => calculateCardInstallmentPlan(2_000, 3, rules))).toBe("BELOW_MINIMUM_INSTALLMENT"); // 6,66 < 10,00
    const loose = { ...rules, minInstallmentInCents: 1 };
    expect(code(() => calculateCardInstallmentPlan(1_400, 3, loose))).toBe("BELOW_MINIMUM_INSTALLMENT"); // 4,66 < Asaas 5,00
    expect(calculateCardInstallmentPlan(1_500, 3, loose).installmentValueInCents).toBe(ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS);
  });

  it("lists only valid counts for the total (R$ 20 at R$ 5 minimum -> up to 4x)", () => {
    const loose = { ...rules, minInstallmentInCents: 500, surchargeBps: { 4: 0, 5: 0, 6: 0 } };
    expect(listCardInstallmentPlans(2_000, loose).map((plan) => plan.installmentCount)).toEqual([1, 2, 3, 4]);
  });

  it("rejects a non-positive base", () => {
    expect(code(() => calculateCardInstallmentPlan(0, 1, rules))).toBe("INVALID_BASE");
  });
});

describe("rules from the flag and the Admin settings", () => {
  const stored = { cardInstallmentsEnabled: true, cardInstallmentsMax: 6, cardInstallmentsMinInCents: 1_000, cardInstallment4xBps: 600, cardInstallment5xBps: 750, cardInstallment6xBps: 900 };

  it("needs BOTH the deploy flag and the Admin toggle", () => {
    expect(resolveCardInstallmentRules(false, stored).enabled).toBe(false);
    expect(resolveCardInstallmentRules(true, { ...stored, cardInstallmentsEnabled: false }).enabled).toBe(false);
    expect(resolveCardInstallmentRules(true, stored)).toEqual(rules);
  });

  it("treats invalid stored values as not offered instead of trusting them", () => {
    const resolved = resolveCardInstallmentRules(true, { ...stored, cardInstallmentsMax: 12, cardInstallmentsMinInCents: 100, cardInstallment5xBps: 9_999 });
    expect(resolved.maxInstallments).toBe(1);
    expect(resolved.minInstallmentInCents).toBe(1_000);
    expect(resolved.surchargeBps[5]).toBeNull();
  });

  it("short copy: interest-free and overall maximum", () => {
    expect(maxOfferedInstallments(rules)).toBe(6);
    expect(maxInterestFreeInstallments(rules)).toBe(3);
    expect(maxOfferedInstallments({ ...rules, surchargeBps: { 4: null, 5: null, 6: null } })).toBe(3);
    expect(maxOfferedInstallments(DISABLED_CARD_INSTALLMENT_RULES)).toBe(1);
  });
});

describe("display and Admin parsing", () => {
  it("states interest-free plainly and always shows the total of surcharged plans", () => {
    expect(describeCardInstallmentPlan(calculateCardInstallmentPlan(60_000, 3, rules)).replace(/ /g, " ")).toBe("3x de R$ 200,00 sem juros");
    expect(describeCardInstallmentPlan(calculateCardInstallmentPlan(60_000, 6, rules)).replace(/ /g, " ")).toBe("6x de R$ 109,00 com acréscimo · Total R$ 654,00");
  });

  it("parses percentages to basis points and back", () => {
    expect(parsePercentToBps("8")).toBe(800);
    expect(parsePercentToBps("8,5")).toBe(850);
    expect(parsePercentToBps("8.25%")).toBe(825);
    expect(parsePercentToBps("")).toBeNull();
    expect(parsePercentToBps("abc")).toBeNaN();
    expect(parsePercentToBps("-1")).toBeNaN();
    expect(formatBpsAsPercent(850)).toBe("8,5%");
    expect(formatBpsAsPercent(800)).toBe("8%");
  });
});
