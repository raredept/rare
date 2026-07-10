import { describe, expect, it } from "vitest";
import {
  calculatePercentDiscountInCents,
  FIRST_ORDER_COUPON_CODE,
  getFirstOrderCouponDiscount,
  normalizeCouponCode,
} from "@/lib/coupons";

describe("first order coupons", () => {
  it("normalizes the welcome code and calculates a rounded-down discount", () => {
    expect(normalizeCouponCode(" rare10 ")).toBe(FIRST_ORDER_COUPON_CODE);
    expect(calculatePercentDiscountInCents(19990, 10)).toBe(1999);
    expect(getFirstOrderCouponDiscount({ code: "rare10", subtotalInCents: 19990, paidOrderCount: 0 })).toEqual({
      code: FIRST_ORDER_COUPON_CODE,
      discountInCents: 1999,
    });
  });

  it("rejects the code after a paid order or when the code is unknown", () => {
    expect(() => getFirstOrderCouponDiscount({ code: FIRST_ORDER_COUPON_CODE, subtotalInCents: 19990, paidOrderCount: 1 })).toThrow(
      "Cupom inválido ou disponível apenas na primeira compra.",
    );
    expect(() => getFirstOrderCouponDiscount({ code: "OUTRO", subtotalInCents: 19990, paidOrderCount: 0 })).toThrow(
      "Cupom inválido ou disponível apenas na primeira compra.",
    );
  });
});
