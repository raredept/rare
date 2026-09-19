import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/checkout/status/route";

const mocks = vi.hoisted(() => ({
  getCurrentCustomer: vi.fn(),
  findFirst: vi.fn(),
  getStripe: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({ getCurrentCustomer: mocks.getCurrentCustomer }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));

const now = new Date("2026-09-13T19:00:00.000Z");
const deadline = new Date("2026-09-13T19:15:00.000Z");
const checkoutUrl = "https://checkout.stripe.com/c/pay/qa-owned-session";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-owned",
    orderNumber: "RARE-QA-001",
    status: "awaiting_payment",
    checkoutDeadlineAt: deadline,
    reservationExpiresAt: deadline,
    checkoutExpiredAt: null,
    stripeCheckoutSessionId: "cs_test_private_session",
    ...overrides,
  };
}

function request(query = "pedido=order-owned") {
  return new NextRequest(`https://rare.example/api/checkout/status?${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  mocks.getCurrentCustomer.mockResolvedValue({ id: "customer-owned" });
  mocks.findFirst.mockResolvedValue(order());
  mocks.getStripe.mockReturnValue({ checkout: { sessions: { retrieve: mocks.retrieve } } });
  mocks.retrieve.mockResolvedValue({ status: "open", payment_status: "unpaid", url: checkoutUrl });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("customer checkout status", () => {
  it("rejects anonymous access before looking up an order or its provider session", async () => {
    mocks.getCurrentCustomer.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Entre na sua conta." });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("scopes an explicit order id to the authenticated customer and conceals inaccessible orders", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await GET(request("pedido=order-of-another-customer&customerId=another-customer"));

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order-of-another-customer", customerId: "customer-owned" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ order: null, serverNow: now.toISOString() });
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("limits automatic recovery to this customer's recent orders with a commercial deadline", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await GET(request(""));

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        customerId: "customer-owned",
        checkoutDeadlineAt: { not: null },
        createdAt: { gte: new Date("2026-09-12T19:00:00.000Z") },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
  });

  it("returns a private, minimal status and an owned open unpaid session without exposing payment identifiers or PII", async () => {
    mocks.findFirst.mockResolvedValue(order({
      customerEmail: "private-qa@example.invalid",
      shippingAddressLine1: "PRIVATE_ADDRESS_MARKER",
      stripePaymentIntentId: "pi_private_marker",
    }));
    mocks.retrieve.mockResolvedValue({
      status: "open", payment_status: "unpaid", url: checkoutUrl,
      client_secret: "PRIVATE_PROVIDER_SECRET_MARKER",
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.retrieve).toHaveBeenCalledWith("cs_test_private_session");
    expect(mocks.findFirst.mock.calls[0][0].select).toEqual({
      id: true, orderNumber: true, status: true, checkoutDeadlineAt: true,
      reservationExpiresAt: true, checkoutExpiredAt: true, stripeCheckoutSessionId: true,
    });
    expect(body).toEqual({
      order: {
        id: "order-owned", orderNumber: "RARE-QA-001", status: "awaiting_payment",
        deadlineAt: deadline.toISOString(), expiredAt: null, processing: false,
        resumeUrl: checkoutUrl,
      },
      serverNow: now.toISOString(),
    });
  });

  it.each([
    { status: "expired", payment_status: "unpaid" },
    { status: "complete", payment_status: "unpaid" },
    { status: "complete", payment_status: "paid" },
    { status: "open", payment_status: "paid" },
  ])("does not resume a provider session with status $status and payment $payment_status", async (session) => {
    mocks.retrieve.mockResolvedValue({ ...session, url: checkoutUrl });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect((await response.json()).order.resumeUrl).toBeNull();
  });

  it("uses the time after provider latency without extending the stored deadline", async () => {
    const answeredAt = new Date(now.getTime() + 10_000);
    mocks.retrieve.mockImplementation(async () => {
      vi.setSystemTime(answeredAt);
      return { status: "open", payment_status: "unpaid", url: checkoutUrl };
    });

    const body = await (await GET(request())).json();

    expect(body.serverNow).toBe(answeredAt.toISOString());
    expect(body.order.deadlineAt).toBe(deadline.toISOString());
    expect(body.order.resumeUrl).toBe(checkoutUrl);
  });

  it.each([0, 1])("removes the resume link when the provider response arrives %s ms after the deadline", async (elapsedMs) => {
    const nearDeadline = new Date(now.getTime() + 5_000);
    const answeredAt = new Date(nearDeadline.getTime() + elapsedMs);
    mocks.findFirst.mockResolvedValue(order({ checkoutDeadlineAt: nearDeadline }));
    mocks.retrieve.mockImplementation(async () => {
      vi.setSystemTime(answeredAt);
      return { status: "open", payment_status: "unpaid", url: checkoutUrl };
    });

    const body = await (await GET(request())).json();

    expect(mocks.retrieve).toHaveBeenCalledTimes(1);
    expect(body.serverNow).toBe(answeredAt.toISOString());
    expect(body.order.deadlineAt).toBe(nearDeadline.toISOString());
    expect(body.order.resumeUrl).toBeNull();
  });

  it("keeps the response clock current after a slow provider failure", async () => {
    const answeredAt = new Date(now.getTime() + 10_000);
    mocks.retrieve.mockImplementation(async () => {
      vi.setSystemTime(answeredAt);
      throw new Error("Synthetic provider timeout");
    });

    const body = await (await GET(request())).json();

    expect(body.serverNow).toBe(answeredAt.toISOString());
    expect(body.order.deadlineAt).toBe(deadline.toISOString());
    expect(body.order.resumeUrl).toBeNull();
  });

  it.each(["paid", "processing", "shipped", "delivered", "canceled", "failed", "refunded"])(
    "does not offer another payment when the local order is %s",
    async (status) => {
      mocks.findFirst.mockResolvedValue(order({ status }));

      const body = await (await GET(request())).json();

      expect(body.order.status).toBe(status);
      expect(body.order.resumeUrl).toBeNull();
      expect(mocks.getStripe).not.toHaveBeenCalled();
    },
  );

  it.each([now, new Date(now.getTime() - 1)])("does not resume at or after the commercial deadline %s", async (elapsedDeadline) => {
    mocks.findFirst.mockResolvedValue(order({
      checkoutDeadlineAt: elapsedDeadline,
      reservationExpiresAt: deadline,
    }));

    const body = await (await GET(request())).json();

    expect(body.order.deadlineAt).toBe(elapsedDeadline.toISOString());
    expect(body.order.resumeUrl).toBeNull();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("reports provider processing without reopening payment when the reservation expiry was cleared", async () => {
    mocks.findFirst.mockResolvedValue(order({ reservationExpiresAt: null }));

    const body = await (await GET(request())).json();

    expect(body.order.processing).toBe(true);
    expect(body.order.deadlineAt).toBe(deadline.toISOString());
    expect(body.order.resumeUrl).toBeNull();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("retains the legacy reservation deadline for a directly requested existing checkout", async () => {
    mocks.findFirst.mockResolvedValue(order({ checkoutDeadlineAt: null }));

    const body = await (await GET(request())).json();

    expect(body.order.deadlineAt).toBe(deadline.toISOString());
    expect(body.order.resumeUrl).toBe(checkoutUrl);
  });

  it("does not invent a deadline or resume link for an order without either deadline", async () => {
    mocks.findFirst.mockResolvedValue(order({ checkoutDeadlineAt: null, reservationExpiresAt: null }));

    const body = await (await GET(request())).json();

    expect(body.order.deadlineAt).toBeNull();
    expect(body.order.resumeUrl).toBeNull();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("keeps status available for an existing owned order while new checkout creation is paused", async () => {
    vi.stubEnv("CHECKOUT_ENABLED", "false");

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.order.id).toBe("order-owned");
    expect(body.order.resumeUrl).toBe(checkoutUrl);
  });

  it("returns useful local status without exposing an unsafe link or provider error when Stripe fails", async () => {
    mocks.retrieve.mockRejectedValue(new Error("PRIVATE_API_SECRET_MARKER private-qa@example.invalid"));

    const response = await GET(request());
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(body.order.id).toBe("order-owned");
    expect(body.order.deadlineAt).toBe(deadline.toISOString());
    expect(body.order.resumeUrl).toBeNull();
    expect(text).not.toContain("PRIVATE_API_SECRET_MARKER");
    expect(text).not.toContain("private-qa@example.invalid");
    expect(text).not.toContain("cs_test_private_session");
  });
});
