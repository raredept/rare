import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";

const webhookMocks = vi.hoisted(() => ({
  processStripeCheckoutEvent: vi.fn(),
  processStripePaymentIntentEvent: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/checkout", () => ({
  processStripeCheckoutEvent: webhookMocks.processStripeCheckoutEvent,
  processStripePaymentIntentEvent: webhookMocks.processStripePaymentIntentEvent,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: webhookMocks.getStripe,
}));

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    STRIPE_WEBHOOK_SECRET: "stripe-webhook-secret-configured-for-unit-test",
  };
  vi.resetAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("stripe webhook route readiness", () => {
  it("rejects requests without Stripe signature before processing events", async () => {
    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Missing signature" });
    expect(webhookMocks.getStripe).not.toHaveBeenCalled();
    expect(webhookMocks.processStripeCheckoutEvent).not.toHaveBeenCalled();
    expect(webhookMocks.processStripePaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("rejects unsigned requests even when the webhook secret is absent locally", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "";

    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Missing signature" });
    expect(webhookMocks.getStripe).not.toHaveBeenCalled();
    expect(webhookMocks.processStripeCheckoutEvent).not.toHaveBeenCalled();
    expect(webhookMocks.processStripePaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("rejects requests when Stripe signature validation fails", async () => {
    const constructEvent = vi.fn(() => {
      throw new Error("Invalid signature for whsec_secret-that-must-not-leak");
    });
    webhookMocks.getStripe.mockReturnValue({
      webhooks: { constructEvent },
    });

    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "bad-signature" },
      body: "{}",
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid signature" });
    expect(constructEvent).toHaveBeenCalled();
    expect(webhookMocks.processStripeCheckoutEvent).not.toHaveBeenCalled();
    expect(webhookMocks.processStripePaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("routes checkout.session.completed to checkout reconciliation", async () => {
    const session = { id: "cs_test_123", payment_status: "paid" };
    webhookMocks.getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => ({
          id: "evt_checkout_completed",
          type: "checkout.session.completed",
          data: { object: session },
        })),
      },
    });
    webhookMocks.processStripeCheckoutEvent.mockResolvedValue({ status: "paid", orderId: "order_1" });

    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid-signature" },
      body: JSON.stringify(session),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, result: { status: "paid", orderId: "order_1" } });
    expect(webhookMocks.processStripeCheckoutEvent).toHaveBeenCalledWith(
      "evt_checkout_completed",
      "checkout.session.completed",
      session,
    );
    expect(webhookMocks.processStripePaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("routes payment_intent events to payment intent reconciliation", async () => {
    const paymentIntent = { id: "pi_test_123", status: "succeeded", metadata: { orderId: "order_1" } };
    webhookMocks.getStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => ({
          id: "evt_payment_intent_succeeded",
          type: "payment_intent.succeeded",
          data: { object: paymentIntent },
        })),
      },
    });
    webhookMocks.processStripePaymentIntentEvent.mockResolvedValue({ status: "already_paid" });

    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid-signature" },
      body: JSON.stringify(paymentIntent),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, result: { status: "already_paid" } });
    expect(webhookMocks.processStripePaymentIntentEvent).toHaveBeenCalledWith(
      "evt_payment_intent_succeeded",
      "payment_intent.succeeded",
      paymentIntent,
    );
    expect(webhookMocks.processStripeCheckoutEvent).not.toHaveBeenCalled();
  });
});
