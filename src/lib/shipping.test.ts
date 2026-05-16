import { describe, expect, it } from "vitest";
import { calculateProvisionalShipping } from "@/lib/shipping";

describe("provisional shipping", () => {
  it("uses fixed shipping calculated on the backend settings", () => {
    const shipping = calculateProvisionalShipping({
      subtotalInCents: 20000,
      cep: "01001-000",
      settings: {
        shippingMode: "fixed",
        fixedShippingInCents: 2500,
        checkoutRequiresAddress: true,
      },
    });

    expect(shipping.shippingInCents).toBe(2500);
    expect(shipping.shippingMethod).toBe("Frete fixo provisório");
    expect(shipping.shippingCep).toBe("01001000");
  });

  it("keeps compatibility with legacy manual shipping value", () => {
    const shipping = calculateProvisionalShipping({
      subtotalInCents: 20000,
      cep: "01001000",
      settings: {
        shippingMode: "manual",
        manualShippingInCents: 1900,
        fixedShippingInCents: 0,
      },
    });

    expect(shipping.shippingInCents).toBe(1900);
    expect(shipping.shippingMethod).toBe("Frete manual provisório");
  });

  it("applies free shipping threshold", () => {
    const shipping = calculateProvisionalShipping({
      subtotalInCents: 50000,
      cep: "01001000",
      settings: {
        shippingMode: "fixed",
        fixedShippingInCents: 2500,
        freeShippingThresholdInCents: 40000,
      },
    });

    expect(shipping.shippingInCents).toBe(0);
    expect(shipping.shippingMethod).toBe("Frete grátis");
    expect(shipping.metadata.freeShippingApplied).toBe(true);
  });

  it("uses disabled mode as manual delivery agreement", () => {
    const shipping = calculateProvisionalShipping({
      subtotalInCents: 20000,
      cep: "01001000",
      settings: {
        shippingMode: "disabled",
      },
    });

    expect(shipping.shippingInCents).toBe(0);
    expect(shipping.shippingMethod).toBe("Entrega a combinar");
    expect(shipping.warnings).toContain("Frete automático desativado; entrega combinada manualmente.");
  });

  it("blocks required checkout address with invalid CEP", () => {
    expect(() =>
      calculateProvisionalShipping({
        subtotalInCents: 20000,
        cep: "123",
        settings: {
          shippingMode: "fixed",
          checkoutRequiresAddress: true,
        },
      }),
    ).toThrow("Informe um CEP válido");
  });
});
