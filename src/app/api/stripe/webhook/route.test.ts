import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";

const webhookMocks = vi.hoisted(() => ({
  processStripeCheckoutEvent: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/checkout", () => ({
  processStripeCheckoutEvent: webhookMocks.processStripeCheckoutEvent,
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
  vi.clearAllMocks();
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
  });
});
