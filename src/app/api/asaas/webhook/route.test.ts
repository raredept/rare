import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  after: vi.fn(),
  processAsaasPayment: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: mocks.after }));
vi.mock("@/lib/prisma", () => ({ prisma: { asaasWebhookEvent: { createMany: mocks.createMany } } }));
vi.mock("@/lib/checkout", () => ({ processAsaasPayment: mocks.processAsaasPayment }));

const originalEnv = process.env;
// Obviously fake, and assembled at runtime so secret scanners never see a key-shaped literal.
const apiKey = ["$aact", "hmlg", `fixture${"0".repeat(40)}`].join("_");
const token = "asaas-webhook-token-with-more-than-32-characters";

function post(body: unknown, headers: Record<string, string> = { "asaas-access-token": token }) {
  return new NextRequest("https://staging.rare.example/api/asaas/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const event = { id: "evt_05b708f961d739ea7eba7e4db318f621&368604920", event: "PAYMENT_RECEIVED", dateCreated: "2026-11-27 16:45:03", payment: { object: "payment", id: "pay_080225913252", value: 1, customer: "cus_x", cpfCnpj: "12345678909" } };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv, APP_ENV: "staging", ASAAS_ENV: "sandbox", ASAAS_API_KEY: apiKey, ASAAS_WEBHOOK_TOKEN: token };
  mocks.createMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  process.env = originalEnv;
});

describe("POST /api/asaas/webhook", () => {
  it("answers 503 and stores nothing when Asaas is not configured", async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    const { POST } = await import("@/app/api/asaas/webhook/route");
    expect((await POST(post(event))).status).toBe(503);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ["missing token", {}],
    ["wrong token", { "asaas-access-token": "x".repeat(48) }],
    ["the API key used as token", { "asaas-access-token": apiKey }],
    ["a Bearer header", { authorization: `Bearer ${token}` }],
  ])("rejects %s with 401 and stores nothing", async (_name, headers) => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    expect((await POST(post(event, headers as Record<string, string>))).status).toBe(401);
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.processAsaasPayment).not.toHaveBeenCalled();
  });

  it("persists only the event id, name and payment id, answers 200 and processes after the response", async () => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    const response = await POST(post(event));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: false });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [{ id: event.id, event: "PAYMENT_RECEIVED", paymentId: "pay_080225913252", status: "pending", processedAt: null }],
      skipDuplicates: true,
    });
    expect(JSON.stringify(mocks.createMany.mock.calls)).not.toContain("12345678909");
    expect(mocks.after).toHaveBeenCalledTimes(1);
    // Nothing is applied synchronously, before the 200.
    expect(mocks.processAsaasPayment).not.toHaveBeenCalled();
  });

  it("acknowledges a redelivered event without scheduling a second effect", async () => {
    mocks.createMany.mockResolvedValueOnce({ count: 0 });
    const { POST } = await import("@/app/api/asaas/webhook/route");
    const response = await POST(post(event));
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("acknowledges unknown or malformed authenticated bodies without storing them", async () => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    for (const body of ["not json", { event: "PAYMENT_RECEIVED" }, { id: "evt_1", event: "<script>" }]) {
      const response = await POST(post(body));
      expect(response.status).toBe(200);
    }
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("stores non-payment events as ignored (no processing)", async () => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    await POST(post({ id: "evt_token_1", event: "ACCESS_TOKEN_EXPIRING_SOON" }));
    expect(mocks.createMany.mock.calls[0][0].data[0]).toMatchObject({ status: "ignored", paymentId: null });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("refuses oversized bodies", async () => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    expect((await POST(post({ ...event, padding: "x".repeat(70 * 1024) }))).status).toBe(413);
  });

  it("enforces the payload limit in UTF-8 bytes, including multibyte text", async () => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    const body = JSON.stringify({ ...event, padding: "é".repeat(35 * 1024) });
    expect(body.length).toBeLessThan(64 * 1024);
    expect(Buffer.byteLength(body)).toBeGreaterThan(64 * 1024);
    expect((await POST(post(body))).status).toBe(413);
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("cancels an oversized stream before draining it even with a false content-length", async () => {
    const { POST } = await import("@/app/api/asaas/webhook/route");
    let pulls = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > 4) controller.close();
        else controller.enqueue(new Uint8Array(40 * 1024));
      },
      cancel,
    }, { highWaterMark: 0 });
    const request = new NextRequest("https://staging.rare.example/api/asaas/webhook", {
      method: "POST", body: stream, duplex: "half",
      headers: { "asaas-access-token": token, "content-length": "1" },
    } as NonNullable<ConstructorParameters<typeof NextRequest>[1]>);
    expect((await POST(request)).status).toBe(413);
    expect(pulls).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("answers 500 (so Asaas retries) only when the event could not be stored", async () => {
    mocks.createMany.mockRejectedValueOnce(new Error("db down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/asaas/webhook/route");
    expect((await POST(post(event))).status).toBe(500);
    error.mockRestore();
  });
});
