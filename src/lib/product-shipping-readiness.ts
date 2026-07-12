export const PRODUCT_SHIPPING_LIMITS = {
  weightGrams: { min: 1, max: 100_000, unit: "g" },
  lengthCm: { min: 1, max: 1_000, unit: "cm" },
  widthCm: { min: 1, max: 1_000, unit: "cm" },
  heightCm: { min: 1, max: 1_000, unit: "cm" },
} as const;

export type ProductShippingField = keyof typeof PRODUCT_SHIPPING_LIMITS;
export type ProductShippingIssueCode =
  | "MISSING_WEIGHT"
  | "MISSING_LENGTH"
  | "MISSING_WIDTH"
  | "MISSING_HEIGHT"
  | "ZERO_WEIGHT"
  | "ZERO_LENGTH"
  | "ZERO_WIDTH"
  | "ZERO_HEIGHT"
  | "NEGATIVE_WEIGHT"
  | "NEGATIVE_LENGTH"
  | "NEGATIVE_WIDTH"
  | "NEGATIVE_HEIGHT"
  | "WEIGHT_OUT_OF_RANGE"
  | "LENGTH_OUT_OF_RANGE"
  | "WIDTH_OUT_OF_RANGE"
  | "HEIGHT_OUT_OF_RANGE"
  | "AMBIGUOUS_WEIGHT_UNIT"
  | "AMBIGUOUS_LENGTH_UNIT"
  | "AMBIGUOUS_WIDTH_UNIT"
  | "AMBIGUOUS_HEIGHT_UNIT"
  | "VARIANT_MAY_CHANGE_PACKAGE";

export type ProductShippingIssue = {
  code: ProductShippingIssueCode;
  field: ProductShippingField | "variants";
  severity: "error" | "warning";
};

export type ProductShippingReadinessInput = {
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  shippingRequired?: boolean;
  activeVariantCount?: number;
};

export type ProductShippingReadiness = {
  ready: boolean;
  shippingRequired: boolean;
  usesFallback: boolean;
  issues: ProductShippingIssue[];
};

const fieldCodes: Record<ProductShippingField, {
  missing: ProductShippingIssueCode;
  zero: ProductShippingIssueCode;
  negative: ProductShippingIssueCode;
  outOfRange: ProductShippingIssueCode;
  ambiguous: ProductShippingIssueCode;
}> = {
  weightGrams: {
    missing: "MISSING_WEIGHT",
    zero: "ZERO_WEIGHT",
    negative: "NEGATIVE_WEIGHT",
    outOfRange: "WEIGHT_OUT_OF_RANGE",
    ambiguous: "AMBIGUOUS_WEIGHT_UNIT",
  },
  lengthCm: {
    missing: "MISSING_LENGTH",
    zero: "ZERO_LENGTH",
    negative: "NEGATIVE_LENGTH",
    outOfRange: "LENGTH_OUT_OF_RANGE",
    ambiguous: "AMBIGUOUS_LENGTH_UNIT",
  },
  widthCm: {
    missing: "MISSING_WIDTH",
    zero: "ZERO_WIDTH",
    negative: "NEGATIVE_WIDTH",
    outOfRange: "WIDTH_OUT_OF_RANGE",
    ambiguous: "AMBIGUOUS_WIDTH_UNIT",
  },
  heightCm: {
    missing: "MISSING_HEIGHT",
    zero: "ZERO_HEIGHT",
    negative: "NEGATIVE_HEIGHT",
    outOfRange: "HEIGHT_OUT_OF_RANGE",
    ambiguous: "AMBIGUOUS_HEIGHT_UNIT",
  },
};

export function assessProductShippingReadiness(input: ProductShippingReadinessInput): ProductShippingReadiness {
  const shippingRequired = input.shippingRequired !== false;
  if (!shippingRequired) {
    return { ready: true, shippingRequired: false, usesFallback: false, issues: [] };
  }

  const issues: ProductShippingIssue[] = [];
  for (const field of Object.keys(PRODUCT_SHIPPING_LIMITS) as ProductShippingField[]) {
    const value = input[field];
    const codes = fieldCodes[field];
    if (value === null || value === undefined || Number.isNaN(value)) {
      issues.push({ code: codes.missing, field, severity: "error" });
      continue;
    }
    if (value === 0) {
      issues.push({ code: codes.zero, field, severity: "error" });
      continue;
    }
    if (value < 0) {
      issues.push({ code: codes.negative, field, severity: "error" });
      continue;
    }
    if (!Number.isInteger(value)) {
      issues.push({ code: codes.ambiguous, field, severity: "error" });
      continue;
    }
    if (value > PRODUCT_SHIPPING_LIMITS[field].max) {
      issues.push({ code: codes.outOfRange, field, severity: "error" });
    }
  }

  if ((input.activeVariantCount ?? 0) > 1) {
    issues.push({ code: "VARIANT_MAY_CHANGE_PACKAGE", field: "variants", severity: "warning" });
  }

  const ready = !issues.some((issue) => issue.severity === "error");
  return { ready, shippingRequired, usesFallback: !ready, issues };
}

export function hasCompleteProductShippingData(input: ProductShippingReadinessInput) {
  return assessProductShippingReadiness(input).ready;
}
