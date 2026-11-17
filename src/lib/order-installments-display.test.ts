import { describe, expect, it } from "vitest";
import { describeOrderInstallments } from "@/lib/order-display";

const sixX = { paymentMethod: "card", paymentInstallmentCount: 6, paymentInstallmentRateBps: 800, paymentInstallmentFeeInCents: 3_840, paymentInstallmentValueInCents: 8_640, paymentLastInstallmentValueInCents: 8_640 };

describe("order installment display (snapshot only)", () => {
  it("shows the plan, the surcharge and the rate saved WITH the order", () => {
    expect(describeOrderInstallments(sixX)).toEqual({ count: 6, feeInCents: 3_840, interestFree: false, rateText: "8%", label: expect.stringMatching(/^6x de R\$\s86,40 com acréscimo$/) });
  });

  it("an old order keeps its 8% even after the Admin moves 6x to 10% (no current rule is read)", () => {
    // describeOrderInstallments has no access to the Admin rules at all: only the order's fields.
    expect(describeOrderInstallments(sixX)?.rateText).toBe("8%");
  });

  it("interest-free plans say so and carry no surcharge", () => {
    expect(describeOrderInstallments({ ...sixX, paymentInstallmentCount: 3, paymentInstallmentRateBps: 0, paymentInstallmentFeeInCents: 0, paymentInstallmentValueInCents: 20_000, paymentLastInstallmentValueInCents: 20_000 })).toMatchObject({ interestFree: true, feeInCents: 0, label: expect.stringMatching(/^3x de R\$\s200,00 sem juros$/) });
  });

  it("shows the last installment when the split leaves a remainder", () => {
    expect(describeOrderInstallments({ ...sixX, paymentInstallmentValueInCents: 3_996, paymentLastInstallmentValueInCents: 4_000 })?.label).toMatch(/última R\$\s40,00/);
  });

  it("nothing for Pix, card 1x and orders created before installments existed", () => {
    expect(describeOrderInstallments({ paymentMethod: "pix", paymentInstallmentCount: null })).toBeNull();
    expect(describeOrderInstallments({ ...sixX, paymentInstallmentCount: 1 })).toBeNull();
    expect(describeOrderInstallments({ paymentMethod: "card" })).toBeNull();
  });
});
