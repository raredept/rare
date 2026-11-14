import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, paymentUnavailableMessage } from "@/lib/checkout";
import { POST } from "@/app/api/checkout/route";
import { resetRateLimitMemoryForTests } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), settings: vi.fn(), stripe: vi.fn(), customer: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/settings", () => ({ getStoreSettings: mocks.settings }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.stripe, normalizePaymentMethodTypes: vi.fn() }));
vi.mock("@/lib/customer-auth", () => ({ getCurrentCustomer: mocks.customer }));

const originalEnv = process.env;
const input = { items: [{ productId: "qa_product", variantId: "qa_variant", quantity: 1 }], customerAddressId: "qa_address", shippingOptionId: "fixed" };
beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitMemoryForTests();
  process.env = { ...originalEnv, CHECKOUT_ENABLED: "true", RATE_LIMIT_DRIVER: "memory", PIX_ENABLED: "true", STRIPE_SECRET_KEY: "synthetic-configured", STRIPE_WEBHOOK_SECRET: "synthetic-configured" };
  mocks.customer.mockResolvedValue({ id: "qa_customer", cpf: "12345678909", active: true });
});
afterEach(() => { process.env = originalEnv; });

describe("retired payment providers fail closed before any state or provider operation", () => {
  it.each([undefined, "", "stripe", " STRIPE ", "mercadopago", "banana", "disabled"])("blocks card and Pix with provider %s", async (provider) => {
    if (provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = provider;
    for (const APP_ENV of ["development", "staging", "production"]) {
      process.env.APP_ENV = APP_ENV;
      for (const paymentMethod of ["card", "pix"]) {
        resetRateLimitMemoryForTests();
        await expect(createCheckoutSession({ ...input, paymentMethod }, { customerId: "qa_customer" })).rejects.toThrow(paymentUnavailableMessage);
        const response = await POST(new Request("https://rare.example/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, paymentMethod }) }) as never);
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: paymentUnavailableMessage });
      }
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.stripe).not.toHaveBeenCalled();
  });
});
