import { PRODUCT_SHIPPING_LIMITS } from "@/lib/product-shipping-readiness";

export function getProductShippingNotReadyWhere() {
  return {
    OR: [
      { weightGrams: null },
      { lengthCm: null },
      { widthCm: null },
      { heightCm: null },
      { weightGrams: { lte: 0 } },
      { lengthCm: { lte: 0 } },
      { widthCm: { lte: 0 } },
      { heightCm: { lte: 0 } },
      { weightGrams: { gt: PRODUCT_SHIPPING_LIMITS.weightGrams.max } },
      { lengthCm: { gt: PRODUCT_SHIPPING_LIMITS.lengthCm.max } },
      { widthCm: { gt: PRODUCT_SHIPPING_LIMITS.widthCm.max } },
      { heightCm: { gt: PRODUCT_SHIPPING_LIMITS.heightCm.max } },
    ],
  };
}
