import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRODUCT_PACKAGE,
  DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS,
  DEFAULT_SHIPPING_ORIGIN_CEP,
  buildPackageFromCart,
  calculateProvisionalShipping,
  getConfiguredShippingProvider,
  getConfiguredShippingOriginCep,
  getFixedShippingQuotes,
  getManualShippingQuotes,
  getShippingQuotes,
  normalizeCep,
  validateCep,
} from "@/lib/shipping";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function packageItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: "prod_1",
    title: "Camiseta RARE",
    quantity: 2,
    priceInCents: 10000,
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

  it("fixed mode returns a single backend-priced option without origin CEP", () => {
    const pkg = buildPackageFromCart([packageItem()]);
    const result = getFixedShippingQuotes({
      settings: {
        shippingMode: "fixed",
        fixedShippingInCents: 2500,
        originCep: null,
      },
      destinationCep: "22041-001",
      package: pkg,
      subtotalInCents: 20000,
    });

    expect(result.options).toEqual([
      expect.objectContaining({
        id: "fixed",
        provider: "fixed",
        service: "fixed",
        label: "Frete fixo",
        amountCents: 2500,
        originCep: null,
        destinationCep: "22041001",
      }),
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("fixed mode blocks clearly when no fixed amount or safe fallback exists", () => {
    expect(() =>
      getFixedShippingQuotes({
        settings: {
          shippingMode: "fixed",
          fixedShippingInCents: 0,
          manualShippingInCents: 0,
          originCep: null,
        },
        destinationCep: "22041-001",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).toThrow("Configure um valor de frete fixo para habilitar o checkout.");
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

  it("uses the store origin CEP fallback when no origin CEP is configured", () => {
    expect(getConfiguredShippingOriginCep({ originCep: null, shippingMode: "melhor_envio" })).toBe(DEFAULT_SHIPPING_ORIGIN_CEP);
  });

  it("calls Melhor Envio with backend product data and normalizes successful quotes", async () => {
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: "PAC",
            price: "21.50",
            custom_price: "19.90",
            delivery_time: 6,
            custom_delivery_time: 5,
            company: { id: 1, name: "Correios" },
          },
          {
            id: 2,
            name: "SEDEX",
            price: "32.40",
            delivery_time: 2,
            company: { id: 1, name: "Correios" },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pkg = buildPackageFromCart([packageItem()]);
    const result = await getShippingQuotes({
      provider: "melhor_envio",
      originCep: "31170-350",
      destinationCep: "01001-000",
      package: pkg,
      subtotalInCents: 20000,
    });
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.melhorenvio.com.br/api/v2/me/shipment/calculate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(payload).toMatchObject({
      from: { postal_code: "31170350" },
      to: { postal_code: "01001000" },
      options: { receipt: false, own_hand: false },
      services: "1,2",
    });
    expect(payload.products).toEqual([
      {
        id: "prod_1",
        width: 24,
        height: 4,
        length: 30,
        weight: 0.4,
        insurance_value: 100,
        quantity: 2,
      },
    ]);
    expect(result.options).toEqual([
      expect.objectContaining({
        id: "melhor_envio:1",
        provider: "melhor_envio",
        service: "1",
        label: "Correios PAC",
        amountCents: 1990,
        estimatedDaysMin: 5,
        estimatedDaysMax: 5,
        deliveryEstimateText: "Prazo estimado em até 5 dias úteis",
        originCep: "31170350",
        destinationCep: "01001000",
        companyName: "Correios",
        rawServiceId: 1,
      }),
      expect.objectContaining({
        id: "melhor_envio:2",
        amountCents: 3240,
      }),
    ]);
  });

  it("accepts MELHOR_ENVIO_ACCESS_TOKEN as the bearer token", async () => {
    vi.stubEnv("MELHOR_ENVIO_ACCESS_TOKEN", "access-token");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify([{ id: 1, name: "PAC", price: "25.00", delivery_time: 7 }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getShippingQuotes({
      provider: "melhor_envio",
      originCep: "31170350",
      destinationCep: "01001000",
      package: buildPackageFromCart([packageItem()]),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("blocks Melhor Envio when only OAuth client credentials are configured", async () => {
    vi.stubEnv("MELHOR_ENVIO_CLIENT_ID", "client-id");
    vi.stubEnv("MELHOR_ENVIO_CLIENT_SECRET", "client-secret");

    await expect(
      getShippingQuotes({
        provider: "melhor_envio",
        originCep: "31170350",
        destinationCep: "01001000",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.toThrow("Configure MELHOR_ENVIO_TOKEN ou finalize a autorização OAuth do Melhor Envio.");
  });

  it("blocks Melhor Envio clearly when no token is configured", async () => {
    await expect(
      getShippingQuotes({
        provider: "melhor_envio",
        originCep: "31170350",
        destinationCep: "01001000",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.toThrow("Configure MELHOR_ENVIO_TOKEN para calcular o frete automaticamente.");
  });

  it("rejects invalid Melhor Envio destination CEP with a human message", async () => {
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");

    await expect(
      getShippingQuotes({
        provider: "melhor_envio",
        originCep: "31170350",
        destinationCep: "123",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.toThrow("Informe um CEP válido para calcular o frete.");
  });

  it.each([
    [401, "Não foi possível autenticar no Melhor Envio. Verifique o token."],
    [403, "Não foi possível autenticar no Melhor Envio. Verifique o token."],
    [422, "Não foi possível calcular o frete com os dados informados."],
    [500, "Frete indisponível no momento. Tente novamente em alguns instantes."],
  ])("maps Melhor Envio HTTP %s to a safe domain error", async (status, message) => {
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "raw provider error" }), { status })));

    await expect(
      getShippingQuotes({
        provider: "melhor_envio",
        originCep: "31170350",
        destinationCep: "01001000",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.toThrow(message);
  });

  it("rejects empty or unusable Melhor Envio options", async () => {
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: 1, name: "PAC", error: "unavailable" },
            { id: 2, name: "SEDEX", price: "0.00" },
          ]),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getShippingQuotes({
        provider: "melhor_envio",
        originCep: "31170350",
        destinationCep: "01001000",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.toThrow("Nenhuma opção de frete disponível para este CEP.");
  });

  it("uses fallback package data in Melhor Envio payload when product dimensions are missing", async () => {
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify([{ id: 1, name: "PAC", price: "20.00", delivery_time: 5 }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pkg = buildPackageFromCart([
      packageItem({
        weightGrams: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
      }),
    ]);
    const result = await getShippingQuotes({
      provider: "melhor_envio",
      originCep: "31170350",
      destinationCep: "01001000",
      package: pkg,
    });
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

    expect(payload.products[0]).toMatchObject({
      width: DEFAULT_PRODUCT_PACKAGE.widthCm,
      height: DEFAULT_PRODUCT_PACKAGE.heightCm,
      length: DEFAULT_PRODUCT_PACKAGE.lengthCm,
      weight: DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS / 1000,
    });
    expect(result.warnings[0]).toContain("fallback controlado");
    expect(result.options[0].raw).toEqual(
      expect.objectContaining({
        usedFallbackWeight: true,
        usedFallbackDimensions: true,
      }),
    );
  });

  it("does not leak the Melhor Envio token in thrown errors", async () => {
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "melhor-token-value-that-must-not-leak");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "melhor-token-value-that-must-not-leak" }), { status: 500 })));

    await expect(
      getShippingQuotes({
        provider: "melhor_envio",
        originCep: "31170350",
        destinationCep: "01001000",
        package: buildPackageFromCart([packageItem()]),
      }),
    ).rejects.not.toThrow("melhor-token-value-that-must-not-leak");
  });
});
