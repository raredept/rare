import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/shipping/quote/route";

const quoteMocks = vi.hoisted(() => ({
  getStoreSettings: vi.fn(),
  prisma: {
    productVariant: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: quoteMocks.prisma,
}));

vi.mock("@/lib/settings", () => ({
  getStoreSettings: quoteMocks.getStoreSettings,
}));

const validBody = {
  cep: "22041-001",
  items: [{ productId: "prod_1", variantId: "var_1", quantity: 2, priceInCents: 1 }],
};

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: "var_1",
    productId: "prod_1",
    active: true,
    product: {
      id: "prod_1",
      title: "Camiseta RARE",
      active: true,
      priceInCents: 10000,
      weightGrams: 400,
      lengthCm: 30,
      widthCm: 24,
      heightCm: 4,
    },
    ...overrides,
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/shipping/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SHIPPING_ENABLED", "true");
  vi.stubEnv("SHIPPING_PROVIDER", "");
  vi.stubEnv("SHIPPING_ORIGIN_CEP", "");
  quoteMocks.getStoreSettings.mockResolvedValue({
    shippingMode: "manual",
    originCep: "01001000",
    fixedShippingInCents: 0,
    manualShippingInCents: 0,
    freeShippingMinInCents: null,
    freeShippingThresholdInCents: null,
    checkoutRequiresAddress: true,
  });
  quoteMocks.prisma.productVariant.findMany.mockResolvedValue([variant()]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("shipping quote route", () => {
  it("rejects invalid CEP before returning quotes", async () => {
    const response = await POST(request({ ...validBody, cep: "123" }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("CEP de destino inválido.");
  });

  it("rejects placeholder CEP values before returning quotes", async () => {
    const response = await POST(request({ ...validBody, cep: "00000-000" }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("CEP de destino inválido.");
    expect(quoteMocks.prisma.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("rejects an empty cart payload", async () => {
    const response = await POST(request({ cep: "22041001", items: [] }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Revise os dados para calcular o frete.");
    expect(quoteMocks.prisma.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("does not trust frontend price fields and returns manual PAC/SEDEX options from backend product data", async () => {
    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(quoteMocks.prisma.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["var_1"] } },
      }),
    );
    expect(body.options.map((option: { service: string }) => option.service)).toEqual(["PAC", "SEDEX"]);
    expect(JSON.stringify(body)).not.toContain("priceInCents");
  });

  it("returns fixed shipping without requiring origin CEP", async () => {
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "fixed",
      originCep: null,
      fixedShippingInCents: 2500,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.options).toEqual([
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
  });

  it("uses the default origin CEP when manual shipping has no configured origin", async () => {
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "manual",
      originCep: null,
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.options.map((option: { service: string }) => option.service)).toEqual(["PAC", "SEDEX"]);
    expect(body.options[0].originCep).toBe("31170350");
  });

  it("returns disabled shipping without requiring a quote", async () => {
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "disabled",
      originCep: null,
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      options: [],
      disabled: true,
    });
    expect(quoteMocks.prisma.productVariant.findMany).not.toHaveBeenCalled();
  });

  it("uses fixed package dimensions when product shipping dimensions are missing", async () => {
    quoteMocks.prisma.productVariant.findMany.mockResolvedValueOnce([
      variant({
        product: {
          id: "prod_1",
          title: "Camiseta RARE",
          active: true,
          priceInCents: 10000,
          weightGrams: null,
          lengthCm: 30,
          widthCm: 24,
          heightCm: 4,
        },
      }),
    ]);

    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.options.map((option: { service: string }) => option.service)).toEqual(["PAC", "SEDEX"]);
  });

  it("fails real provider configuration without leaking credentials", async () => {
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "correios",
      originCep: "01001000",
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.");
  });

  it("returns normalized Melhor Envio options using originCep from settings", async () => {
    vi.stubEnv("SHIPPING_PROVIDER", "melhor_envio");
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify([{ id: 1, name: "PAC", custom_price: "22.30", custom_delivery_time: 5, company: { name: "Correios" } }]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "fixed",
      originCep: "31170-350",
      fixedShippingInCents: 2500,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

    expect(response.status).toBe(200);
    expect(payload.from.postal_code).toBe("31170350");
    expect(body.options).toEqual([
      expect.objectContaining({
        id: "melhor_envio:1",
        provider: "melhor_envio",
        service: "1",
        label: "Correios PAC",
        amountCents: 2230,
        originCep: "31170350",
        destinationCep: "22041001",
      }),
    ]);
    expect(body.options.map((option: { provider: string }) => option.provider)).not.toContain("manual");
  });

  it("uses the default store origin CEP for Melhor Envio when settings originCep is empty", async () => {
    vi.stubEnv("SHIPPING_PROVIDER", "melhor_envio");
    vi.stubEnv("MELHOR_ENVIO_TOKEN", "test-token");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify([{ id: 2, name: "SEDEX", price: "30.00", delivery_time: 2 }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "melhor_envio",
      originCep: null,
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

    expect(response.status).toBe(200);
    expect(payload.from.postal_code).toBe("31170350");
    expect(body.options[0]).toEqual(
      expect.objectContaining({
        provider: "melhor_envio",
        amountCents: 3000,
      }),
    );
  });

  it("returns a clear Melhor Envio configuration error without falling back to manual quotes", async () => {
    vi.stubEnv("SHIPPING_PROVIDER", "melhor_envio");
    quoteMocks.getStoreSettings.mockResolvedValueOnce({
      shippingMode: "manual",
      originCep: "31170350",
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
      checkoutRequiresAddress: true,
    });

    const response = await POST(request(validBody) as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Configure MELHOR_ENVIO_TOKEN para calcular o frete automaticamente.");
  });
});
