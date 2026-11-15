import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileCheckoutExpiry } from "@/lib/checkout-expiry";
import { MercadoPagoError } from "@/lib/mercadopago";

const mocks = vi.hoisted(() => ({
  prisma: { order: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn() } },
  getStripe: vi.fn(),
  processMercadoPagoPayment: vi.fn(),
  releasePixOrderWithoutPayment: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
  cancelMercadoPagoPayment: vi.fn(),
  findMercadoPagoPaymentsForOrder: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("@/lib/checkout", () => ({
  processMercadoPagoPayment: mocks.processMercadoPagoPayment,
  releasePixOrderWithoutPayment: mocks.releasePixOrderWithoutPayment,
  processStripeCheckoutEvent: vi.fn(),
  processStripePaymentIntentEvent: vi.fn(),
}));
vi.mock("@/lib/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mercadopago")>()),
  getMercadoPagoConfig: () => ({ accessToken: "synthetic", webhookSecret: "synthetic", mode: "test" }),
  getMercadoPagoPayment: mocks.getMercadoPagoPayment,
  cancelMercadoPagoPayment: mocks.cancelMercadoPagoPayment,
  findMercadoPagoPaymentsForOrder: mocks.findMercadoPagoPaymentsForOrder,
}));

function order(overrides: Record<string, unknown> = {}) {
  return { id: "order_pix_1", status: "awaiting_payment", paymentProvider: "mercadopago", mercadoPagoPaymentId: "1320000001", createdAt: new Date("2026-10-13T15:00:00.000Z"), ...overrides };
}
function payment(status: string, overrides: Record<string, unknown> = {}) {
  return { id: "1320000001", status, externalReference: "order_pix_1", amountInCents: 21990, currency: "brl", paymentMethodId: "pix", ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T15:30:05.000Z"));
  vi.resetAllMocks();
  mocks.prisma.order.findUniqueOrThrow.mockResolvedValue(order());
  mocks.prisma.order.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("reconcileCheckoutExpiry for a Pix order", () => {
  it("never touches Stripe and confirms a Pix that was paid", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(payment("approved"));
    mocks.processMercadoPagoPayment.mockResolvedValueOnce({ status: "paid", orderId: "order_pix_1" });

    expect((await reconcileCheckoutExpiry("order_pix_1")).outcome).toBe("paid");
    expect(mocks.processMercadoPagoPayment).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    expect(mocks.cancelMercadoPagoPayment).not.toHaveBeenCalled();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("closes an unpaid Pix at Mercado Pago BEFORE releasing the stock", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(payment("pending")).mockResolvedValueOnce(payment("cancelled"));
    mocks.cancelMercadoPagoPayment.mockResolvedValueOnce(payment("cancelled"));
    mocks.processMercadoPagoPayment.mockResolvedValueOnce({ status: "released" });

    expect((await reconcileCheckoutExpiry("order_pix_1")).outcome).toBe("released");
    expect(mocks.cancelMercadoPagoPayment).toHaveBeenCalledWith(expect.anything(), "1320000001");
    expect(mocks.cancelMercadoPagoPayment.mock.invocationCallOrder[0]).toBeLessThan(mocks.processMercadoPagoPayment.mock.invocationCallOrder[0]);
    expect(mocks.processMercadoPagoPayment).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
  });

  it("confirms the order when the shopper pays while the Pix is being closed", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(payment("pending")).mockResolvedValueOnce(payment("approved"));
    mocks.cancelMercadoPagoPayment.mockRejectedValueOnce(new MercadoPagoError("rejected", "MercadoPagoRejectedRequest", 400));
    mocks.processMercadoPagoPayment.mockResolvedValueOnce({ status: "paid", orderId: "order_pix_1" });

    expect((await reconcileCheckoutExpiry("order_pix_1")).outcome).toBe("paid");
    expect(mocks.processMercadoPagoPayment).toHaveBeenCalledTimes(1);
    expect(mocks.processMercadoPagoPayment).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
  });

  it("holds the stock and retries while the Pix is still payable or the provider is unreachable", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValue(payment("pending"));
    mocks.cancelMercadoPagoPayment.mockRejectedValueOnce(new MercadoPagoError("unknown", "MercadoPagoDeadlineExceeded"));
    await expect(reconcileCheckoutExpiry("order_pix_1")).rejects.toThrow("PROVIDER_NOT_EXPIRED");

    mocks.getMercadoPagoPayment.mockReset();
    mocks.getMercadoPagoPayment.mockRejectedValueOnce(new MercadoPagoError("unknown", "MercadoPagoTemporarilyUnavailable", 503));
    await expect(reconcileCheckoutExpiry("order_pix_1")).rejects.toThrow("MercadoPagoTemporarilyUnavailable");
    expect(mocks.processMercadoPagoPayment).not.toHaveBeenCalled();
    expect(mocks.releasePixOrderWithoutPayment).not.toHaveBeenCalled();
  });

  it("keeps the reservation without a deadline while the payment is in process", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(payment("in_process"));
    expect((await reconcileCheckoutExpiry("order_pix_1")).outcome).toBe("processing");
    expect(mocks.prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reservationExpiresAt: null } }));
    expect(mocks.cancelMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("refuses a payment that points to another order", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(payment("approved", { externalReference: "order_other" }));
    await expect(reconcileCheckoutExpiry("order_pix_1")).rejects.toThrow("SESSION_ORDER_MISMATCH");
    expect(mocks.processMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("recovers a Pix whose creation response was lost, preferring an approved one", async () => {
    mocks.prisma.order.findUniqueOrThrow.mockResolvedValueOnce(order({ mercadoPagoPaymentId: null }));
    mocks.findMercadoPagoPaymentsForOrder.mockResolvedValueOnce([payment("cancelled", { id: "7" }), payment("approved", { id: "8" })]);
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(payment("approved", { id: "8" }));
    mocks.processMercadoPagoPayment.mockResolvedValueOnce({ status: "paid", orderId: "order_pix_1" });

    expect((await reconcileCheckoutExpiry("order_pix_1")).outcome).toBe("paid");
    expect(mocks.getMercadoPagoPayment).toHaveBeenCalledWith(expect.anything(), "8");
  });

  it("releases an order that never got a Pix, but only once the search can be trusted", async () => {
    mocks.findMercadoPagoPaymentsForOrder.mockResolvedValue([]);

    // Created seconds ago: the search may simply not show the payment yet.
    mocks.prisma.order.findUniqueOrThrow.mockResolvedValueOnce(order({ mercadoPagoPaymentId: null, createdAt: new Date("2026-10-13T15:29:30.000Z") }));
    await expect(reconcileCheckoutExpiry("order_pix_1")).rejects.toThrow("SESSION_CREATION_UNCONFIRMED");
    expect(mocks.releasePixOrderWithoutPayment).not.toHaveBeenCalled();

    mocks.prisma.order.findUniqueOrThrow.mockResolvedValueOnce(order({ mercadoPagoPaymentId: null }));
    mocks.releasePixOrderWithoutPayment.mockResolvedValueOnce(true);
    expect((await reconcileCheckoutExpiry("order_pix_1")).outcome).toBe("released");
    expect(mocks.releasePixOrderWithoutPayment).toHaveBeenCalledWith("order_pix_1");
  });

  it("leaves a finished order alone", async () => {
    mocks.prisma.order.findUniqueOrThrow.mockResolvedValueOnce(order({ status: "paid" }));
    expect(await reconcileCheckoutExpiry("order_pix_1")).toEqual({ outcome: "terminal" });
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
  });
});
