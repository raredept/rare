import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentMethodPicker } from "@/components/store/payment-method-picker";

function render(provider?: "stripe" | "asaas") {
  return renderToStaticMarkup(createElement(PaymentMethodPicker, { value: "pix", onChange: () => undefined, provider }));
}

describe("PaymentMethodPicker", () => {
  it("names Asaas by default and never offers a retired Stripe picker", () => {
    const html = render();
    expect(html).not.toContain("Stripe");
    expect(html).toContain("Asaas");
    expect(render("stripe")).toBe("");
  });

  it("names Asaas, and only credit card, when Asaas takes the payment", () => {
    const html = render("asaas");
    expect(html).toContain("Asaas");
    expect(html).not.toContain("Stripe");
    expect(html).not.toContain("débito");
  });
});
