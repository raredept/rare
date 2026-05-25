import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPackageFromCart,
  calculateProvisionalShipping,
  getConfiguredShippingProvider,
  getManualShippingQuotes,
  getShippingQuotes,
  normalizeCep,
  validateCep,
} from "@/lib/shipping";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  vi.unstubAllEnvs();
});

function packageItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: "prod_1",
    title: "Camiseta RARE",
    quantity: 2,
    weightGrams: 400,
    lengthCm: 30,
    widthCm: 24,
    heightCm: 4,
    ...overrides,
  };
}

describe("shipping domain", () => {
  it("normalizes and validates CEP values", () => {
    expect(normalizeCep("01001-000")).toBe("01001000");
    expect(validateCep("01001000", "CEP de destino")).toBe("01001000");
    expect(() => validateCep("123", "CEP de destino")).toThrow("CEP de destino inválido.");
    expect(() => validateCep("00000-000", "CEP de destino")).toThrow("CEP de destino inválido.");
  });

  it("keeps legacy provisional fixed freight available when shipping quote mode is disabled", () => {
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

  it("builds a package from trusted backend product data", () => {
    const pkg = buildPackageFromCart([packageItem(), packageItem({ productId: "prod_2", quantity: 1, weightGrams: 900 })]);

    expect(pkg.weightGrams).toBe(1700);
    expect(pkg.lengthCm).toBe(30);
    expect(pkg.widthCm).toBe(24);
    expect(pkg.heightCm).toBe(12);
    expect(pkg.items).toHaveLength(2);
  });

  it("uses the fixed package dimensions and approximate weight when a product has no shipping data", () => {
    const pkg = buildPackageFromCart([
      packageItem({
        weightGrams: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
      }),
    ]);

    expect(pkg).toMatchObject({
      weightGrams: 1000 * 2,
      lengthCm: 35,
      widthCm: 35,
      heightCm: 20,
    });
    expect(pkg.items[0]).toMatchObject({
      weightGrams: 1000,
      lengthCm: 35,
      widthCm: 35,
      heightCm: 10,
    });
  });

  it("manual provider returns PAC and SEDEX fallback quotes", async () => {
    const pkg = buildPackageFromCart([packageItem()]);
    const result = await getManualShippingQuotes({
      originCep: "01001000",
      destinationCep: "22041001",
      package: pkg,
    });

    expect(result.options.map((option) => option.service)).toEqual(["PAC", "SEDEX"]);
    expect(result.options.every((option) => option.provider === "manual")).toBe(true);
    expect(result.options[0].label).toContain("cálculo manual");
    expect(result.warnings[0]).toContain("manual/fallback");
  });

  it("uses SHIPPING_PROVIDER when configured and rejects missing real-provider credentials cleanly", async () => {
    vi.stubEnv("SHIPPING_PROVIDER", "correios");

    expect(getConfiguredShippingProvider({ shippingMode: "manual" })).toBe("correios");
    await expect(
      getShippingQuotes({
        provider: "correios",
        originCep: "01001000",
        destinationCep: "22041001",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.toThrow("Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.");
  });
});
