import { describe, expect, it } from "vitest";
import { formatCompactCurrency } from "@/components/admin/analytics-charts";

describe("formatCompactCurrency", () => {
  it("keeps small amounts exact", () => {
    expect(formatCompactCurrency(0)).toContain("0,00");
    expect(formatCompactCurrency(45_67)).toContain("45,67");
    expect(formatCompactCurrency(999_99)).toContain("999,99");
  });

  it("abbreviates thousands of reais, not thousands of cents", () => {
    // 1_500_00 cents is R$1.500,00 -> R$2k, never R$150k.
    expect(formatCompactCurrency(1_500_00)).toBe("R$2k");
    expect(formatCompactCurrency(15_000_00)).toBe("R$15k");
    expect(formatCompactCurrency(150_000_00)).toBe("R$150k");
  });

  it("abbreviates millions of reais at the right threshold", () => {
    // R$999.999 stays in thousands; R$1.000.000 becomes millions.
    expect(formatCompactCurrency(999_999_00)).toBe("R$1000k");
    expect(formatCompactCurrency(1_000_000_00)).toBe("R$1,0M");
    expect(formatCompactCurrency(10_549_302_75)).toBe("R$10,5M");
  });

  it("uses a Brazilian decimal comma", () => {
    expect(formatCompactCurrency(2_500_000_00)).toBe("R$2,5M");
  });
});
