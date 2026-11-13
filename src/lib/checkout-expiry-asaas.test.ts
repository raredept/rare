import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasError } from "@/lib/asaas";

const mocks = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  findCustomer: vi.fn(),
  processAsaasPayment: vi.fn(),
  releaseAsaasOrderWithoutPayment: vi.fn(),
  getAsaasPayment: vi.fn(),
  deleteAsaasPayment: vi.fn(),
  findAsaasPaymentsForOrder: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUniqueOrThrow: mocks.findUniqueOrThrow }, customer: { findUnique: mocks.findCustomer } } }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/checkout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/checkout")>();
  return {
    classifyAsaasPayment: actual.classifyAsaasPayment,
    processAsaasPayment: mocks.processAsaasPayment,
    releaseAsaasOrderWithoutPayment: mocks.releaseAsaasOrderWithoutPayment,
    processMercadoPagoPayment: vi.fn(),
    processStripeCheckoutEvent: vi.fn(),
    processStripePaymentIntentEvent: vi.fn(),
    releasePixOrderWithoutPayment: vi.fn(),
  };
});
vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  getAsaasConfig: () => ({ environment: "sandbox", apiBase: "https://api-sandbox.asaas.com/v3", apiKey: "k", webhookToken: "t" }),
  getAsaasPayment: mocks.getAsaasPayment,
  deleteAsaasPayment: mocks.deleteAsaasPayment,
  findAsaasPaymentsForOrder: mocks.findAsaasPaymentsForOrder,
}));

const order = { id: "order_asaas_1", customerId: "customer_qa", status: "awaiting_payment", paymentProvider: "asaas", asaasPaymentId: "pay_080225913252", createdAt: new Date(Date.now() - 3_600_000) };
const pending = { id: "pay_080225913252", status: "PENDING", billingType: "PIX", amountInCents: 17000, customerId: "cus_1", externalReference: "order_asaas_1", invoiceUrl: null, deleted: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUniqueOrThrow.mockResolvedValue(order);
  mocks.findCustomer.mockResolvedValue({ asaasCustomerId: "cus_1" });
});

describe("Asaas checkout expiry", () => {
  it("deletes the unpaid charge at Asaas BEFORE releasing the stock", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce(pending).mockResolvedValueOnce({ ...pending, deleted: true });
    mocks.deleteAsaasPayment.mockResolvedValueOnce(true);
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "released" });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).resolves.toMatchObject({ outcome: "released" });
    expect(mocks.deleteAsaasPayment.mock.invocationCallOrder[0]).toBeLessThan(mocks.processAsaasPayment.mock.invocationCallOrder[0]);
    expect(mocks.processAsaasPayment).toHaveBeenCalledWith(expect.objectContaining({ deleted: true }));
  });

  it("settles a payment that arrived while the charge was being closed (race)", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce(pending).mockResolvedValueOnce({ ...pending, status: "RECEIVED" });
    mocks.deleteAsaasPayment.mockRejectedValueOnce(new AsaasError("rejected", "AsaasRejectedRequest", 400));
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "paid" });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).resolves.toMatchObject({ outcome: "paid" });
  });

  it("keeps the stock (retry) when Asaas cannot confirm the charge is closed", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending);
    mocks.deleteAsaasPayment.mockRejectedValueOnce(new AsaasError("unknown", "AsaasTemporarilyUnavailable", 503));
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("PROVIDER_NOT_EXPIRED");
    expect(mocks.processAsaasPayment).not.toHaveBeenCalled();
  });

  it("treats a charge that disappeared after deletion as closed", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce(pending).mockRejectedValueOnce(new AsaasError("rejected", "AsaasNotFound", 404));
    mocks.deleteAsaasPayment.mockResolvedValueOnce(true);
    mocks.processAsaasPayment.mockImplementation(async (payment) => ({ status: payment.customerId === "cus_1" ? "released" : "payment_mismatch" }));
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).resolves.toMatchObject({ outcome: "released" });
    expect(mocks.processAsaasPayment).toHaveBeenCalledWith(expect.objectContaining({ deleted: true, customerId: "cus_1" }));
  });

  it("never reports paid when payment reconciliation rejected the binding or value", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce({ ...pending, status: "RECEIVED" });
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "payment_mismatch" });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("SESSION_ORDER_MISMATCH");
    expect(mocks.deleteAsaasPayment).not.toHaveBeenCalled();
  });

  it("does not delete a payable charge belonging to another customer", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce({ ...pending, customerId: "cus_other" });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("SESSION_ORDER_MISMATCH");
    expect(mocks.deleteAsaasPayment).not.toHaveBeenCalled();
  });

  it("holds an ambiguous reservation when more than one charge exists for its reference", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ ...order, asaasPaymentId: null });
    mocks.findAsaasPaymentsForOrder.mockResolvedValueOnce([pending, { ...pending, id: "pay_0_qa123456789abc" }]);
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("SESSION_CREATION_UNCONFIRMED");
    expect(mocks.deleteAsaasPayment).not.toHaveBeenCalled();
    expect(mocks.releaseAsaasOrderWithoutPayment).not.toHaveBeenCalled();
  });

  it("does not fabricate a customer identity when the stored mapping is missing", async () => {
    mocks.findCustomer.mockResolvedValueOnce({ asaasCustomerId: null });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("SESSION_ORDER_MISMATCH");
    expect(mocks.getAsaasPayment).not.toHaveBeenCalled();
    expect(mocks.deleteAsaasPayment).not.toHaveBeenCalled();
  });

  it("holds the stock while Asaas analyses the payment", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce({ ...pending, status: "AWAITING_RISK_ANALYSIS" });
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "processing" });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).resolves.toMatchObject({ outcome: "processing" });
    expect(mocks.deleteAsaasPayment).not.toHaveBeenCalled();
  });

  it("recovers a lost creation response through the order reference, and waits before giving up", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ ...order, asaasPaymentId: null, createdAt: new Date() });
    mocks.findAsaasPaymentsForOrder.mockResolvedValueOnce([]);
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("SESSION_CREATION_UNCONFIRMED");

    mocks.findUniqueOrThrow.mockResolvedValue({ ...order, asaasPaymentId: null });
    mocks.findAsaasPaymentsForOrder.mockResolvedValueOnce([]);
    mocks.releaseAsaasOrderWithoutPayment.mockResolvedValueOnce(true);
    await expect(reconcileCheckoutExpiry("order_asaas_1")).resolves.toMatchObject({ outcome: "released" });
  });

  it("refuses a charge that belongs to another order", async () => {
    mocks.getAsaasPayment.mockResolvedValueOnce({ ...pending, externalReference: "other_order" });
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    await expect(reconcileCheckoutExpiry("order_asaas_1")).rejects.toThrow("SESSION_ORDER_MISMATCH");
  });
});
