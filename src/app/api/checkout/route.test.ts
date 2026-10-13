import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";
import { POST } from "@/app/api/checkout/route";

const routeMocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getCurrentCustomer: vi.fn(),
}));

vi.mock("@/lib/checkout", () => ({
  checkoutRequiresCpfMessage: "Precisamos de um CPF válido para finalizar sua compra.",
  checkoutRequiresLoginMessage: "Para finalizar sua compra, entre ou crie sua conta.",
  checkoutInProgressMessage: "Você já tem um checkout em andamento. Aguarde alguns instantes e tente novamente.",
  paymentInProgressMessage: "Você já tem um pagamento em andamento. Aguarde a confirmação antes de iniciar outra compra.",
  pixUnavailableMessage: "O Pix está indisponível no momento. Escolha cartão ou tente novamente em instantes.",
  createCheckoutSession: routeMocks.createCheckoutSession,
}));

vi.mock("@/lib/customer-auth", () => ({
  getCurrentCustomer: routeMocks.getCurrentCustomer,
}));

const originalEnv = process.env;

beforeEach(() => {
  resetRateLimitMemoryForTests();
  process.env = {
    ...originalEnv,
    CHECKOUT_ENABLED: "false",
  };
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("checkout route readiness", () => {
  it("returns a controlled response when checkout is disabled", async () => {
    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Checkout temporariamente indisponível. Fale com a RARE para concluir seu pedido por enquanto.",
    });
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(routeMocks.getCurrentCustomer).not.toHaveBeenCalled();
  });

  it("requires a customer session before touching checkout state when checkout is enabled", async () => {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    routeMocks.getCurrentCustomer.mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }] }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Para finalizar sua compra, entre ou crie sua conta.",
    });
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(routeMocks.getCurrentCustomer).toHaveBeenCalledTimes(1);
  });

  it("blocks checkout when the logged customer has no valid CPF", async () => {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: null,
      cpf: null,
      active: true,
    });

    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }] }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Precisamos de um CPF válido para finalizar sua compra.",
    });
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("requires a Stripe secret after the customer session and CPF are valid", async () => {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "";
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: null,
      cpf: "12345678909",
      active: true,
    });

    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }] }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Checkout temporariamente indisponível. Fale com a RARE para concluir seu pedido por enquanto.",
    });
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("passes the authenticated customer id to checkout session creation", async () => {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: null,
      cpf: "12345678909",
      active: true,
    });
    routeMocks.createCheckoutSession.mockResolvedValueOnce({
      url: "https://checkout.stripe.test/session",
      orderId: "order_1",
      orderNumber: "RARE-TEST",
    });

    const payload = {
      items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }],
      cpf: "00000000000",
    };
    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://checkout.stripe.test/session",
      orderId: "order_1",
      orderNumber: "RARE-TEST",
    });
    expect(routeMocks.createCheckoutSession).toHaveBeenCalledWith(payload, { customerId: "customer_1" });
  });
});

describe("checkout route double submit", () => {
  it("answers 409 to a second session creation for the same customer within the guard window", async () => {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    routeMocks.getCurrentCustomer.mockResolvedValue({ id: "customer_dbl", cpf: "12345678909" });
    routeMocks.createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/s", orderId: "o1" });
    const make = () => POST(new Request("http://localhost/api/checkout", { method: "POST", body: JSON.stringify({ items: [] }) }) as never);

    const first = await make();
    const second = await make();

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(routeMocks.createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});

describe("checkout route coupon errors", () => {
  it("tells the shopper an invalid coupon is a client error instead of an outage", async () => {
    process.env.CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    routeMocks.getCurrentCustomer.mockResolvedValue({ id: "customer_coupon", cpf: "12345678909" });
    routeMocks.createCheckoutSession.mockRejectedValue(new Error("Cupom inválido ou disponível apenas na primeira compra."));

    const response = await POST(new Request("http://localhost/api/checkout", { method: "POST", body: JSON.stringify({ items: [] }) }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Cupom inválido ou disponível apenas na primeira compra." });
  });
});

describe("checkout route with Pix", () => {
  const customer = { id: "customer_1", name: "Cliente Teste", email: "cliente@example.com", phone: null, cpf: "12345678909", active: true };
  const pixRequest = () => new Request("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify({ items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }], paymentMethod: "pix" }),
  });
  // Synthetic values only.
  const mercadoPagoEnv = {
    APP_ENV: "staging",
    PIX_ENABLED: "true",
    MERCADOPAGO_ACCESS_TOKEN: ["TEST", "1234567890123456", "101326", "syntheticcanary0123456789abcdef", "42"].join("-"),
    MERCADOPAGO_WEBHOOK_SECRET: "syntheticwebhooksecret0123456789abcdef",
  };

  it("refuses a Pix checkout before reserving stock when Pix is off or not configured", async () => {
    for (const env of [{}, { ...mercadoPagoEnv, PIX_ENABLED: "false" }, { ...mercadoPagoEnv, MERCADOPAGO_WEBHOOK_SECRET: "" }]) {
      resetRateLimitMemoryForTests();
      process.env = { ...originalEnv, CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_123", ...env };
      routeMocks.getCurrentCustomer.mockResolvedValueOnce(customer);

      const response = await POST(pixRequest() as never);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "O Pix está indisponível no momento. Escolha cartão ou tente novamente em instantes." });
    }
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates a Pix checkout without needing any Stripe credential", async () => {
    process.env = { ...originalEnv, CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "", ...mercadoPagoEnv };
    routeMocks.getCurrentCustomer.mockResolvedValueOnce(customer);
    routeMocks.createCheckoutSession.mockResolvedValueOnce({ url: "/pedido/pix/order_pix_1", orderId: "order_pix_1", orderNumber: "RARE-PIX" });

    const response = await POST(pixRequest() as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ url: "/pedido/pix/order_pix_1" });
    expect(routeMocks.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod: "pix" }), { customerId: "customer_1" });
  });

  it("answers 400 to a body that is not JSON, without creating anything", async () => {
    process.env = { ...originalEnv, CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_123" };
    routeMocks.getCurrentCustomer.mockResolvedValueOnce(customer);

    const response = await POST(new Request("http://localhost/api/checkout", { method: "POST", body: "{not json" }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Revise os dados do checkout." });
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
  });
});
