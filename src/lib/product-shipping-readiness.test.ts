import { describe, expect, it } from "vitest";
import { assessProductShippingReadiness, PRODUCT_SHIPPING_LIMITS } from "@/lib/product-shipping-readiness";

const complete = { weightGrams: 500, lengthCm: 30, widthCm: 24, heightCm: 8 };

describe("product shipping readiness", () => {
  it("accepts complete integer data with explicit units", () => {
    expect(assessProductShippingReadiness(complete)).toEqual({
      ready: true,
      shippingRequired: true,
      usesFallback: false,
      issues: [],
    });
  });

  it("returns stable field codes for missing data", () => {
    const result = assessProductShippingReadiness({ ...complete, weightGrams: null, widthCm: undefined });
    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: "MISSING_WEIGHT", field: "weightGrams", severity: "error" },
      { code: "MISSING_WIDTH", field: "widthCm", severity: "error" },
    ]));
  });

  it.each([
    [0, "ZERO_WEIGHT"],
    [-1, "NEGATIVE_WEIGHT"],
    [1.5, "AMBIGUOUS_WEIGHT_UNIT"],
    [PRODUCT_SHIPPING_LIMITS.weightGrams.max + 1, "WEIGHT_OUT_OF_RANGE"],
  ])("classifies invalid weight %s", (weightGrams, code) => {
    expect(assessProductShippingReadiness({ ...complete, weightGrams }).issues).toContainEqual(
      expect.objectContaining({ code, field: "weightGrams" }),
    );
  });

  it("keeps variant review as a warning without blocking readiness", () => {
    const result = assessProductShippingReadiness({ ...complete, activeVariantCount: 3 });
    expect(result.ready).toBe(true);
    expect(result.issues).toContainEqual({ code: "VARIANT_MAY_CHANGE_PACKAGE", field: "variants", severity: "warning" });
  });

  it("supports an explicit future no-shipping product without requiring dimensions", () => {
    expect(assessProductShippingReadiness({ shippingRequired: false })).toEqual({
      ready: true,
      shippingRequired: false,
      usesFallback: false,
      issues: [],
    });
  });
});
