import { describe, expect, it } from "vitest";
import { buildProductShippingAudit, type ProductShippingAuditProduct } from "@/lib/product-shipping-audit";

function product(overrides: Partial<ProductShippingAuditProduct> = {}): ProductShippingAuditProduct {
  return {
    id: "prod-1",
    slug: "produto-1",
    active: true,
    weightGrams: 500,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    activeVariantCount: 1,
    ...overrides,
  };
}

describe("product shipping audit", () => {
  it("reports totals by problem category without treating warnings as invalid", () => {
    const report = buildProductShippingAudit([
      product(),
      product({ id: "missing", slug: "missing", weightGrams: null, widthCm: null }),
      product({ id: "invalid", slug: "invalid", weightGrams: -2, heightCm: 0 }),
      product({ id: "variants", slug: "variants", activeVariantCount: 3 }),
    ], 20);

    expect(report.totalProducts).toBe(20);
    expect(report.summary).toEqual(expect.objectContaining({
      valid: 2,
      usingFallback: 2,
      missingWeight: 1,
      missingDimensions: 1,
      zeroValues: 1,
      negativeValues: 1,
      variantReview: 1,
    }));
    expect(report.issueTotals.MISSING_WEIGHT).toBe(1);
  });

  it("counts explicitly non-shipping products separately", () => {
    const report = buildProductShippingAudit([product({ shippingRequired: false, weightGrams: null })]);
    expect(report.summary.ignoredNoShipping).toBe(1);
    expect(report.summary.usingFallback).toBe(0);
  });
});
