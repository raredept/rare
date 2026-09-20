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
    expect(state.paymentTitle).toBe("Pagamento seguro");
  });

  it("only claims the payment methods that are actually enabled", () => {
    expect(buildStorefrontCommerceState(true, ["card"]).paymentTitle).toBe("Cartão");
    expect(buildStorefrontCommerceState(true, ["card"]).paymentText).not.toMatch(/Pix/);
    expect(buildStorefrontCommerceState(true, ["pix"]).paymentTitle).toBe("Pix");
    expect(buildStorefrontCommerceState(true, ["card", "pix"]).paymentTitle).toBe("Pix e cartão");
    expect(getStorefrontCommerceState({ CHECKOUT_ENABLED: "true", STRIPE_PAYMENT_METHOD_TYPES: "card" }).paymentTitle).toBe("Cartão");
    expect(getStorefrontCommerceState({ CHECKOUT_ENABLED: "true", STRIPE_PAYMENT_METHOD_TYPES: "card,pix" }).paymentTitle).toBe("Pix e cartão");
    expect(getStorefrontCommerceState({ CHECKOUT_ENABLED: "true" }).paymentText).not.toMatch(/Pix/);
  });
});
