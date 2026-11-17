import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasError } from "@/lib/asaas";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  updateMany: vi.fn(),
  notify: vi.fn(),
  getAsaasPayment: vi.fn(),
  getAsaasConfig: vi.fn(() => ({ environment: "sandbox", apiBase: "https://api-sandbox.asaas.com/v3", apiKey: "k", webhookToken: "t" })),
  processAsaasPayment: vi.fn(),
  getAsaasInstallmentOrDeleted: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw, asaasWebhookEvent: { updateMany: mocks.updateMany }, adminNotification: { createMany: mocks.notify } } }));
vi.mock("@/lib/checkout", () => ({ processAsaasPayment: mocks.processAsaasPayment }));
vi.mock("@/lib/asaas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/asaas")>()), getAsaasPayment: mocks.getAsaasPayment, getAsaasConfig: mocks.getAsaasConfig, getAsaasInstallmentOrDeleted: mocks.getAsaasInstallmentOrDeleted }));

const now = new Date("2026-11-27T15:00:00Z");
function claimed(overrides: Record<string, unknown> = {}) {
  return [{ id: "evt_1", event: "PAYMENT_RECEIVED", paymentId: "pay_080225913252", status: "processing", attempts: 1, ...overrides }];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("Asaas webhook inbox processing", () => {
  it("re-reads the payment from the API (never trusts the body) and marks the event processed", async () => {
    mocks.queryRaw.mockResolvedValueOnce(claimed()).mockResolvedValueOnce([]);
    mocks.getAsaasPayment.mockResolvedValueOnce({ id: "pay_080225913252", status: "RECEIVED" });
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "paid", orderId: "o1" });
    const { processAsaasWebhookEvents } = await import("@/lib/asaas-webhook");
    await expect(processAsaasWebhookEvents({ now: () => now })).resolves.toEqual([{ eventId: "evt_1", outcome: "paid" }]);
    expect(mocks.getAsaasPayment).toHaveBeenCalledWith(expect.anything(), "pay_080225913252");
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "processed" }) }));
  });

  it("retries with backoff on a temporary failure, keeping the event", async () => {
    mocks.queryRaw.mockResolvedValueOnce(claimed()).mockResolvedValueOnce([]);
    mocks.getAsaasPayment.mockRejectedValueOnce(new AsaasError("unknown", "AsaasTemporarilyUnavailable", 503));
    const { processAsaasWebhookEvents } = await import("@/lib/asaas-webhook");
    await processAsaasWebhookEvents({ now: () => now });
    const data = mocks.updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "retry", lastErrorCode: "AsaasTemporarilyUnavailable" });
    expect(data.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("gives up after the maximum attempts and alerts the Admin", async () => {
    mocks.queryRaw.mockResolvedValueOnce(claimed({ attempts: 12 })).mockResolvedValueOnce([]);
    mocks.processAsaasPayment.mockRejectedValueOnce(new Error("Reserved stock is not available"));
    mocks.getAsaasPayment.mockResolvedValueOnce({ id: "pay_080225913252", status: "RECEIVED" });
    const { processAsaasWebhookEvents } = await import("@/lib/asaas-webhook");
    await processAsaasWebhookEvents({ now: () => now });
    expect(mocks.updateMany.mock.calls[0][0].data).toMatchObject({ status: "failed", lastErrorCode: "PROCESSING_FAILED" });
    expect(mocks.notify.mock.calls[0][0].data[0]).toMatchObject({ type: "payment_webhook_failed" });
  });

  it("ignores events for payments that are not ours (dashboard test events)", async () => {
    mocks.queryRaw.mockResolvedValueOnce(claimed()).mockResolvedValueOnce([]);
    mocks.getAsaasPayment.mockRejectedValueOnce(new AsaasError("rejected", "AsaasNotFound", 404));
    const { processAsaasWebhookEvents } = await import("@/lib/asaas-webhook");
    await expect(processAsaasWebhookEvents({ now: () => now })).resolves.toEqual([{ eventId: "evt_1", outcome: "ignored" }]);
    expect(mocks.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ignored" });
  });

  it("parses only safe identifiers from the body", async () => {
    const { parseAsaasWebhookBody } = await import("@/lib/asaas-webhook");
    expect(parseAsaasWebhookBody({ id: "evt_1", event: "PAYMENT_CONFIRMED", payment: { id: "pay_080225913252" } })).toEqual({ id: "evt_1", event: "PAYMENT_CONFIRMED", paymentId: "pay_080225913252" });
    expect(parseAsaasWebhookBody({ id: "evt_1", event: "PAYMENT_CONFIRMED", payment: { id: "../../customers" } })).toEqual({ id: "evt_1", event: "PAYMENT_CONFIRMED", paymentId: null });
    expect(parseAsaasWebhookBody({ id: "evt 1; DROP", event: "PAYMENT_CONFIRMED" })).toBeNull();
    expect(parseAsaasWebhookBody(null)).toBeNull();
  });

  it("keeps the real Sandbox segmented payment id for asynchronous processing", async () => {
    const { parseAsaasWebhookBody } = await import("@/lib/asaas-webhook");
    expect(parseAsaasWebhookBody({ id: "evt_qa_real_shape", event: "PAYMENT_CREATED", payment: { id: "pay_0_qa123456789abc" } })).toEqual({ id: "evt_qa_real_shape", event: "PAYMENT_CREATED", paymentId: "pay_0_qa123456789abc" });
  });

  it("reads the installment plan from the API too, and passes it with the payment (never from the body)", async () => {
    const plan = { id: "5e1f7c2a-0b1d-4c3e-9f00-0000000000aa", totalInCents: 23980, installmentCount: 6, billingType: "CREDIT_CARD", customerId: "cus_1", deleted: false };
    mocks.queryRaw.mockResolvedValueOnce(claimed({ event: "PAYMENT_CONFIRMED" })).mockResolvedValueOnce([]);
    mocks.getAsaasPayment.mockResolvedValueOnce({ id: "pay_080225913252", status: "CONFIRMED", installmentId: plan.id });
    mocks.getAsaasInstallmentOrDeleted.mockResolvedValueOnce(plan);
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "paid", orderId: "o1" });
    const { processAsaasWebhookEvents } = await import("@/lib/asaas-webhook");
    await expect(processAsaasWebhookEvents({ now: () => now })).resolves.toEqual([{ eventId: "evt_1", outcome: "paid" }]);
    expect(mocks.getAsaasInstallmentOrDeleted).toHaveBeenCalledWith(expect.anything(), plan.id);
    expect(mocks.processAsaasPayment).toHaveBeenCalledWith(expect.objectContaining({ installmentId: plan.id }), plan);
  });

  it("does not read any plan for a single charge (Pix and card 1x unchanged)", async () => {
    mocks.queryRaw.mockResolvedValueOnce(claimed()).mockResolvedValueOnce([]);
    mocks.getAsaasPayment.mockResolvedValueOnce({ id: "pay_080225913252", status: "RECEIVED", installmentId: null });
    mocks.processAsaasPayment.mockResolvedValueOnce({ status: "paid", orderId: "o1" });
    const { processAsaasWebhookEvents } = await import("@/lib/asaas-webhook");
    await processAsaasWebhookEvents({ now: () => now });
    expect(mocks.getAsaasInstallmentOrDeleted).not.toHaveBeenCalled();
    expect(mocks.processAsaasPayment).toHaveBeenCalledWith(expect.objectContaining({ id: "pay_080225913252" }), null);
  });
});
