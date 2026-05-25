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
    checkoutRequiresAddress: true,
  });
  quoteMocks.prisma.productVariant.findMany.mockResolvedValue([variant()]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shipping quote route", () => {
  it("rejects invalid CEP before returning quotes", async () => {
    const response = await POST(request({ ...validBody, cep: "123" }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("CEP de destino inválido.");
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

  it("returns a friendly product-dimensions error", async () => {
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

    expect(response.status).toBe(400);
    expect(body.error).toBe("Esse produto ainda precisa de peso e medidas para calcular o frete.");
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
});
