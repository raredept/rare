import { assessProductShippingReadiness, type ProductShippingIssueCode } from "@/lib/product-shipping-readiness";

export type ProductShippingAuditProduct = {
  id: string;
  slug: string;
  active: boolean;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  activeVariantCount: number;
  shippingRequired?: boolean;
};

export type ProductShippingAuditItem = ProductShippingAuditProduct & {
  ready: boolean;
  usesFallback: boolean;
  issueCodes: ProductShippingIssueCode[];
};

export function buildProductShippingAudit(products: ProductShippingAuditProduct[], totalProducts = products.length) {
  const items: ProductShippingAuditItem[] = products.map((product) => {
    const readiness = assessProductShippingReadiness(product);
    return {
      ...product,
      ready: readiness.ready,
      usesFallback: readiness.usesFallback,
      issueCodes: readiness.issues.map((issue) => issue.code),
    };
  });
  const hasAny = (item: ProductShippingAuditItem, codes: ProductShippingIssueCode[]) =>
    item.issueCodes.some((code) => codes.includes(code));
  const issueTotals = Object.fromEntries(
    [...new Set(items.flatMap((item) => item.issueCodes))]
      .sort()
      .map((code) => [code, items.filter((item) => item.issueCodes.includes(code)).length]),
  ) as Partial<Record<ProductShippingIssueCode, number>>;

  return {
    totalProducts,
    analyzed: items.length,
    summary: {
      valid: items.filter((item) => item.ready).length,
      usingFallback: items.filter((item) => item.usesFallback).length,
      missingWeight: items.filter((item) => hasAny(item, ["MISSING_WEIGHT"])).length,
      missingDimensions: items.filter((item) => hasAny(item, ["MISSING_LENGTH", "MISSING_WIDTH", "MISSING_HEIGHT"])).length,
      zeroValues: items.filter((item) => hasAny(item, ["ZERO_WEIGHT", "ZERO_LENGTH", "ZERO_WIDTH", "ZERO_HEIGHT"])).length,
      negativeValues: items.filter((item) => hasAny(item, ["NEGATIVE_WEIGHT", "NEGATIVE_LENGTH", "NEGATIVE_WIDTH", "NEGATIVE_HEIGHT"])).length,
      outOfRange: items.filter((item) => hasAny(item, ["WEIGHT_OUT_OF_RANGE", "LENGTH_OUT_OF_RANGE", "WIDTH_OUT_OF_RANGE", "HEIGHT_OUT_OF_RANGE"])).length,
      unitAmbiguous: items.filter((item) => hasAny(item, ["AMBIGUOUS_WEIGHT_UNIT", "AMBIGUOUS_LENGTH_UNIT", "AMBIGUOUS_WIDTH_UNIT", "AMBIGUOUS_HEIGHT_UNIT"])).length,
      variantReview: items.filter((item) => item.issueCodes.includes("VARIANT_MAY_CHANGE_PACKAGE")).length,
      ignoredNoShipping: items.filter((item) => item.shippingRequired === false).length,
    },
    issueTotals,
    items,
  };
}
