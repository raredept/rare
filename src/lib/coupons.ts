export const FIRST_ORDER_COUPON_CODE = "RARE10";
export const FIRST_ORDER_COUPON_PERCENT = 10;

export const paidOrderStatuses = ["paid", "processing", "shipped", "delivered"] as const;

export function normalizeCouponCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

export function calculatePercentDiscountInCents(subtotalInCents: number, percent: number) {
  if (subtotalInCents <= 0 || percent <= 0) return 0;
  return Math.min(subtotalInCents, Math.floor((subtotalInCents * percent) / 100));
}

export function getFirstOrderCouponDiscount({
  code,
  subtotalInCents,
  paidOrderCount,
}: {
  code?: string | null;
  subtotalInCents: number;
  paidOrderCount: number;
}) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return { code: null, discountInCents: 0 };

  if (normalizedCode !== FIRST_ORDER_COUPON_CODE || paidOrderCount > 0) {
    throw new Error("Cupom inválido ou disponível apenas na primeira compra.");
  }

  return {
    code: FIRST_ORDER_COUPON_CODE,
    discountInCents: calculatePercentDiscountInCents(subtotalInCents, FIRST_ORDER_COUPON_PERCENT),
  };
}
