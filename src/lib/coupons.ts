export const FIRST_ORDER_COUPON_CODE = "RARE10";
export const FIRST_ORDER_COUPON_PERCENT = 10;

export const paidOrderStatuses = ["paid", "processing", "shipped", "delivered"] as const;

/**
 * The first-order benefit is consumed by the first order whose payment was confirmed, and stays
 * consumed: a later refund, cancellation or chargeback does not give it back (no coupon -> buy ->
 * refund -> coupon loop). `paidAt` is stamped once when the provider confirms the payment and is
 * never cleared, so it is the durable, auditable marker. Orders that were never paid (pending,
 * awaiting payment, expired, failed, canceled before payment) have no `paidAt` and consume nothing.
 */
export function firstOrderCouponConsumedWhere(customerId: string) {
  // The status branch only covers legacy rows paid before `paidAt` existed; a refund moves the
  // status away from it, which is why `paidAt` is the rule.
  return { customerId, OR: [{ paidAt: { not: null } }, { status: { in: [...paidOrderStatuses] } }] };
}

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
