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
