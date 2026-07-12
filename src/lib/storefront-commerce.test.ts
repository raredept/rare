import { describe, expect, it } from "vitest";
import { buildStorefrontCommerceState, getStorefrontCommerceState } from "@/lib/storefront-commerce";

describe("storefront commerce communication", () => {
  it("does not promise payment when checkout is disabled", () => {
    const state = getStorefrontCommerceState({ CHECKOUT_ENABLED: "false" });

    expect(state.checkoutEnabled).toBe(false);
    expect(state.checkoutActionLabel).toContain("pausadas");
    expect(`${state.checkoutStatusText} ${state.paymentText}`).not.toMatch(/Pix ou cartão no checkout/i);
    expect(state.paymentText).toContain("Nenhum pagamento");
  });

  it("restores normal checkout communication when enabled", () => {
    const state = buildStorefrontCommerceState(true);

    expect(state.checkoutEnabled).toBe(true);
    expect(state.checkoutActionLabel).toBe("Finalizar compra");
    expect(state.paymentTitle).toBe("Pix e cartão");
  });
});
