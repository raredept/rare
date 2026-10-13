import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mercadopago/webhook/route";
import { MercadoPagoError } from "@/lib/mercadopago";

const mocks = vi.hoisted(() => ({
  processMercadoPagoPayment: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
}));

vi.mock("@/lib/checkout", () => ({ processMercadoPagoPayment: mocks.processMercadoPagoPayment }));
vi.mock("@/lib/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mercadopago")>()),
  getMercadoPagoPayment: mocks.getMercadoPagoPayment,
}));

// Synthetic values only.
const TOKEN = ["TEST", "1234567890123456", "101326", "syntheticcanary0123456789abcdef", "42"].join("-");
const SECRET = "syntheticwebhooksecret0123456789abcdef";
const REQUEST_ID = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
const originalEnv = process.env;

function notification(options: { id?: string; type?: string; secret?: string; signature?: string | null; body?: unknown; query?: boolean } = {}) {
  const id = options.id ?? "1320000001";
  const type = options.type ?? "payment";
  const ts = "1791850000";
  const digest = createHmac("sha256", options.secret ?? SECRET).update(`id:${id};request-id:${REQUEST_ID};ts:${ts};`).digest("hex");
  const signature = options.signature === undefined ? `ts=${ts},v1=${digest}` : options.signature;
  const url = options.query === false ? "https://loja.example/api/mercadopago/webhook" : `https://loja.example/api/mercadopago/webhook?data.id=${id}&type=${type}`;
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": REQUEST_ID, ...(signature ? { "x-signature": signature } : {}) },
    body: JSON.stringify(options.body ?? { action: "payment.updated", type, data: { id }, live_mode: false }),
  });
}

beforeEach(() => {
  process.env = { ...originalEnv, APP_ENV: "staging", MERCADOPAGO_ACCESS_TOKEN: TOKEN, MERCADOPAGO_WEBHOOK_SECRET: SECRET };
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("Mercado Pago webhook", () => {
  it("answers 500 without reading anything when the integration is not configured", async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const response = await POST(notification());
    expect(response.status).toBe(500);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["no signature", { signature: null }],
    ["a signature made with another secret", { secret: "anothersyntheticsecret0123456789" }],
    ["a malformed signature", { signature: "ts=1,v1=zz" }],
  ])("rejects %s before any API call or database work", async (_label, options) => {
    const response = await POST(notification(options));
    expect(response.status).toBe(401);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
    expect(mocks.processMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("rejects a signature that was made for another payment id", async () => {
    const signedForOther = notification({ id: "1320000002" }).headers.get("x-signature");
    const response = await POST(notification({ id: "1320000001", signature: signedForOther }));
    expect(response.status).toBe(401);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("uses the payment state from the API, never the notification body", async () => {
    const apiPayment = { id: "1320000001", status: "pending", amountInCents: 21990, currency: "brl", externalReference: "order_pix_1", paymentMethodId: "pix" };
    mocks.getMercadoPagoPayment.mockResolvedValueOnce(apiPayment);
    mocks.processMercadoPagoPayment.mockResolvedValueOnce({ status: "ignored" });

    // The body claims an approval for a huge amount; only the id is taken from it.
    const response = await POST(notification({ body: { type: "payment", data: { id: "1320000001" }, status: "approved", transaction_amount: 999999 } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: { status: "ignored" } });
    expect(mocks.getMercadoPagoPayment).toHaveBeenCalledWith(expect.objectContaining({ accessToken: TOKEN }), "1320000001");
    expect(mocks.processMercadoPagoPayment).toHaveBeenCalledWith(apiPayment);
  });

  it("acknowledges notifications that are not about one of our payments", async () => {
    const otherTopic = await POST(notification({ type: "merchant_order" }));
    expect(otherTopic.status).toBe(200);
    expect(await otherTopic.json()).toEqual({ received: true, ignored: true });
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();

    // The dashboard's "simulate notification" sends an id that does not exist in the account.
    mocks.getMercadoPagoPayment.mockRejectedValueOnce(new MercadoPagoError("rejected", "MercadoPagoNotFound", 404));
    const unknownPayment = await POST(notification({ id: "123456" }));
    expect(unknownPayment.status).toBe(200);
    expect(await unknownPayment.json()).toEqual({ received: true, ignored: true });
    expect(mocks.processMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("answers 500 so Mercado Pago retries when the lookup or the processing fails", async () => {
    mocks.getMercadoPagoPayment.mockRejectedValueOnce(new MercadoPagoError("unknown", "MercadoPagoTemporarilyUnavailable", 503));
    expect((await POST(notification())).status).toBe(500);

    mocks.getMercadoPagoPayment.mockResolvedValueOnce({ id: "1320000001", status: "approved" });
    mocks.processMercadoPagoPayment.mockRejectedValueOnce(new Error(`Mercado Pago payment total does not match order RARE-1 https://internal.example/${TOKEN}`));
    const response = await POST(notification());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Webhook processing failed" });
    // Nothing secret reaches the log line.
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain(TOKEN);
  });

  it("still processes notifications for existing orders while new Pix sales are paused", async () => {
    process.env.PIX_ENABLED = "false";
    mocks.getMercadoPagoPayment.mockResolvedValueOnce({ id: "1320000001", status: "approved" });
    mocks.processMercadoPagoPayment.mockResolvedValueOnce({ status: "paid", orderId: "order_pix_1" });
    const response = await POST(notification());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: { status: "paid" } });
  });

  it("refuses an oversized body", async () => {
    const response = await POST(notification({ body: { type: "payment", data: { id: "1320000001" }, padding: "x".repeat(20_000) } }));
    expect(response.status).toBe(413);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
  });
});
