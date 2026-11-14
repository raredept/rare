import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildPixPaymentRequest,
  cancelMercadoPagoPayment,
  createPixPayment,
  findMercadoPagoPaymentsForOrder,
  formatMercadoPagoDate,
  getMercadoPagoConfig,
  getMercadoPagoConfigurationIssue,
  getMercadoPagoPayment,
  isPixCheckoutAvailable,
  MercadoPagoError,
  normalizeMercadoPagoPayment,
  verifyMercadoPagoSignature,
  type MercadoPagoConfig,
} from "@/lib/mercadopago";

// Synthetic values only. Nothing below is a credential.
const TEST_TOKEN = ["TEST", "1234567890123456", "101326", "syntheticcanary0123456789abcdef", "42"].join("-");
const LIVE_TOKEN = ["APP_USR", "1234567890123456", "101326", "syntheticcanary0123456789abcdef", "42"].join("-");
const SECRET = "syntheticwebhooksecret0123456789abcdef";
const baseEnv = { APP_ENV: "staging", PIX_ENABLED: "true", MERCADOPAGO_ACCESS_TOKEN: TEST_TOKEN, MERCADOPAGO_WEBHOOK_SECRET: SECRET };
const config: MercadoPagoConfig = { accessToken: TEST_TOKEN, webhookSecret: SECRET, mode: "test" };

const pixInput = {
  orderId: "cmfz8q1x40001abcdorder01",
  orderNumber: "RARE-20261013-ABC123",
  totalInCents: 14247,
  providerExpiresAt: new Date("2026-10-13T15:32:00.000Z"),
  payer: { email: "cliente@example.org", name: "Maria Clara de Souza", cpf: "529.982.247-25" },
  notificationUrl: "https://raredept.com.br/api/mercadopago/webhook",
};

const pendingPix = {
  id: 1320000001,
  status: "pending",
  status_detail: "pending_waiting_transfer",
  transaction_amount: 142.47,
  currency_id: "BRL",
  external_reference: pixInput.orderId,
  payment_method_id: "pix",
  live_mode: false,
  point_of_interaction: {
    transaction_data: {
      qr_code: "00020126580014br.gov.bcb.pix0136synthetic5204000053039865406142.475802BR6304ABCD",
      qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      ticket_url: "https://www.mercadopago.com.br/payments/1320000001/ticket?caller_id=1",
    },
  },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sign(manifest: string, secret = SECRET) {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("Mercado Pago configuration", () => {
  it("accepts a complete configuration and reports the credential mode", () => {
    expect(getMercadoPagoConfigurationIssue(baseEnv)).toBeNull();
    expect(getMercadoPagoConfig(baseEnv)).toEqual({ accessToken: TEST_TOKEN, webhookSecret: SECRET, mode: "test" });
    expect(getMercadoPagoConfig({ ...baseEnv, MERCADOPAGO_ACCESS_TOKEN: `Bearer ${LIVE_TOKEN}` }).mode).toBe("live");
    expect(isPixCheckoutAvailable(baseEnv)).toBe(true);
  });

  it.each([
    [{ MERCADOPAGO_ACCESS_TOKEN: "" }, "MissingMERCADOPAGO_ACCESS_TOKEN"],
    [{ MERCADOPAGO_ACCESS_TOKEN: "not a token" }, "InvalidMercadoPagoAccessToken"],
    [{ MERCADOPAGO_ACCESS_TOKEN: ["sk", "live", "wrongprovider0123456789"].join("_") }, "InvalidMercadoPagoAccessToken"],
    [{ MERCADOPAGO_WEBHOOK_SECRET: "" }, "MissingMERCADOPAGO_WEBHOOK_SECRET"],
    [{ MERCADOPAGO_WEBHOOK_SECRET: "has space inside it" }, "InvalidMercadoPagoWebhookSecret"],
    [{ APP_ENV: "production" }, "MercadoPagoTestCredentialInProduction"],
  ])("rejects %j with %s and never offers Pix", (override, code) => {
    const env = { ...baseEnv, ...override };
    expect(getMercadoPagoConfigurationIssue(env)).toBe(code);
    expect(isPixCheckoutAvailable(env)).toBe(false);
    expect(() => getMercadoPagoConfig(env)).toThrow(code);
  });

  it("offers Pix only when the flag is on, even with valid credentials", () => {
    expect(isPixCheckoutAvailable({ ...baseEnv, PIX_ENABLED: "false" })).toBe(false);
    expect(isPixCheckoutAvailable({ ...baseEnv, PIX_ENABLED: undefined })).toBe(false);
    expect(isPixCheckoutAvailable({ ...baseEnv, APP_ENV: "production", MERCADOPAGO_ACCESS_TOKEN: LIVE_TOKEN })).toBe(true);
  });

  it("never echoes a credential in a configuration error", () => {
    const env = { ...baseEnv, MERCADOPAGO_WEBHOOK_SECRET: "bad secret value" };
    expect(`${getMercadoPagoConfigurationIssue(env)}`).not.toMatch(/bad secret|TEST-/);
  });
});

describe("Pix payment request", () => {
  it("charges exactly the order total and ties the payment to the order", () => {
    expect(buildPixPaymentRequest(pixInput)).toEqual({
      transaction_amount: 142.47,
      description: "Pedido RARE-20261013-ABC123 — RARE",
      payment_method_id: "pix",
      external_reference: pixInput.orderId,
      date_of_expiration: "2026-10-13T12:32:00.000-03:00",
      notification_url: "https://raredept.com.br/api/mercadopago/webhook",
      payer: { email: "cliente@example.org", first_name: "Maria", last_name: "Clara de Souza", identification: { type: "CPF", number: "52998224725" } },
    });
  });

  it("keeps cents exact for amounts that floating point represents badly", () => {
    for (const cents of [1, 99, 1005, 10010, 123456789]) {
      const sent = buildPixPaymentRequest({ ...pixInput, totalInCents: cents }).transaction_amount;
      expect(Math.round(sent * 100)).toBe(cents);
      expect(normalizeMercadoPagoPayment({ ...pendingPix, transaction_amount: sent }).amountInCents).toBe(cents);
    }
  });

  it("refuses a zero, negative or fractional amount before any network call", () => {
    for (const cents of [0, -100, 10.5, Number.NaN]) {
      expect(() => buildPixPaymentRequest({ ...pixInput, totalInCents: cents })).toThrow("InvalidPixAmount");
    }
  });

  it("only sends a notification URL that Mercado Pago can call", () => {
    expect(buildPixPaymentRequest({ ...pixInput, notificationUrl: "http://localhost:3000/api/mercadopago/webhook" })).not.toHaveProperty("notification_url");
    expect(buildPixPaymentRequest({ ...pixInput, notificationUrl: undefined })).not.toHaveProperty("notification_url");
  });

  it("formats the expiry in Brasília time with an explicit offset", () => {
    expect(formatMercadoPagoDate(new Date("2026-10-14T01:05:09.123Z"))).toBe("2026-10-13T22:05:09.123-03:00");
  });

  it("posts to the fixed API host with the token, an idempotency key per order and no redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, pendingPix));
    const payment = await createPixPayment(config, pixInput, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers).toMatchObject({ authorization: `Bearer ${TEST_TOKEN}`, "x-idempotency-key": `rare-pix-${pixInput.orderId}`, "content-type": "application/json" });
    expect(payment).toMatchObject({ id: "1320000001", status: "pending", amountInCents: 14247, currency: "brl", externalReference: pixInput.orderId, paymentMethodId: "pix" });
    expect(payment.pix.copyPaste).toContain("br.gov.bcb.pix");
    expect(payment.pix.ticketUrl).toContain("https://www.mercadopago.com.br/");
  });

  it("drops a ticket link that does not point to Mercado Pago", () => {
    const tampered = { ...pendingPix, point_of_interaction: { transaction_data: { ...pendingPix.point_of_interaction.transaction_data, ticket_url: "https://mercadopago.com.br.evil.example/pay" } } };
    expect(normalizeMercadoPagoPayment(tampered).pix?.ticketUrl).toBeNull();
  });

  it("treats a created payment without Pix data as unknown, never as a clean failure", async () => {
    const error = await createPixPayment(config, pixInput, { fetchImpl: async () => jsonResponse(201, { ...pendingPix, point_of_interaction: {} }) }).catch((e) => e);
    expect(error).toBeInstanceOf(MercadoPagoError);
    expect(error).toMatchObject({ outcome: "unknown", code: "MercadoPagoPixDataMissing" });
  });
});

describe("Mercado Pago failure classification", () => {
  async function failure(fetchImpl: (input: string, init: RequestInit) => Promise<Response>, timeoutMs?: number) {
    return createPixPayment(config, pixInput, { fetchImpl, timeoutMs }).then(() => { throw new Error("expected a failure"); }, (error) => error as MercadoPagoError);
  }

  it.each([
    [400, "rejected", "MercadoPagoRejectedRequest"],
    [401, "rejected", "MercadoPagoAuthenticationFailed"],
    [403, "rejected", "MercadoPagoAuthenticationFailed"],
    [404, "rejected", "MercadoPagoNotFound"],
    [422, "rejected", "MercadoPagoRejectedRequest"],
    [408, "unknown", "MercadoPagoTemporarilyUnavailable"],
    [409, "unknown", "MercadoPagoTemporarilyUnavailable"],
    [429, "unknown", "MercadoPagoTemporarilyUnavailable"],
    [500, "unknown", "MercadoPagoTemporarilyUnavailable"],
    [503, "unknown", "MercadoPagoTemporarilyUnavailable"],
    [302, "unknown", "MercadoPagoUnexpectedRedirect"],
  ])("HTTP %i → %s %s", async (status, outcome, code) => {
    const error = await failure(async () => jsonResponse(status, { message: `leaky ${TEST_TOKEN}`, cause: [] }));
    expect({ outcome: error.outcome, code: error.code, status: error.status }).toEqual({ outcome, code, status });
    expect(`${error.message} ${error.stack ?? ""}`).not.toContain(TEST_TOKEN);
  });

  it("only calls a failure clean when Mercado Pago was never reached", async () => {
    const dns = await failure(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }); });
    expect({ outcome: dns.outcome, code: dns.code }).toEqual({ outcome: "rejected", code: "MercadoPagoUnreachable" });

    const reset = await failure(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }); });
    expect({ outcome: reset.outcome, code: reset.code }).toEqual({ outcome: "unknown", code: "MercadoPagoResponseLost" });

    const slow = await failure((_input, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }), 5);
    expect({ outcome: slow.outcome, code: slow.code }).toEqual({ outcome: "unknown", code: "MercadoPagoDeadlineExceeded" });
  });

  it("treats an unreadable 2xx as unknown", async () => {
    const html = await failure(async () => jsonResponse(200, "<html>ok</html>"));
    expect({ outcome: html.outcome, code: html.code }).toEqual({ outcome: "unknown", code: "MercadoPagoUnexpectedResponse" });
    const noId = await failure(async () => jsonResponse(201, { status: "pending" }));
    expect({ outcome: noId.outcome, code: noId.code }).toEqual({ outcome: "unknown", code: "MercadoPagoUnexpectedResponse" });
  });
});

describe("Mercado Pago payment lookups", () => {
  it("reads, cancels and searches only on the fixed host and validates identifiers first", async () => {
    const fetchImpl = vi.fn(async (url: string) => jsonResponse(200, url.includes("/search") ? { results: [pendingPix, { ...pendingPix, id: 9, external_reference: "another-order-000" }] } : pendingPix));

    await getMercadoPagoPayment(config, "1320000001", { fetchImpl });
    await cancelMercadoPagoPayment(config, "1320000001", { fetchImpl });
    const found = await findMercadoPagoPaymentsForOrder(config, pixInput.orderId, { fetchImpl });

    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      "GET https://api.mercadopago.com/v1/payments/1320000001",
      "PUT https://api.mercadopago.com/v1/payments/1320000001",
      `GET https://api.mercadopago.com/v1/payments/search?external_reference=${pixInput.orderId}&sort=date_created&criteria=desc&limit=10`,
    ]);
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ status: "cancelled" });
    // A result that belongs to another order is never returned for this one.
    expect(found.map((payment) => payment.id)).toEqual(["1320000001"]);

    for (const bad of ["", "12/../../users", "abc", "1 OR 1=1"]) {
      await expect(getMercadoPagoPayment(config, bad, { fetchImpl })).rejects.toMatchObject({ code: "InvalidMercadoPagoPaymentId" });
      await expect(cancelMercadoPagoPayment(config, bad, { fetchImpl })).rejects.toMatchObject({ code: "InvalidMercadoPagoPaymentId" });
    }
    await expect(findMercadoPagoPaymentsForOrder(config, "x&status=approved", { fetchImpl })).rejects.toMatchObject({ code: "InvalidOrderReference" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("Mercado Pago webhook signature", () => {
  const requestId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
  const ts = "1791850000";
  const valid = { signatureHeader: `ts=${ts},v1=${sign(`id:1320000001;request-id:${requestId};ts:${ts};`)}`, requestId, dataId: "1320000001", secret: SECRET };

  it("accepts the documented manifest", () => {
    expect(verifyMercadoPagoSignature(valid)).toBe(true);
    // Spaces around the parts and an upper-case digest are the same signature.
    expect(verifyMercadoPagoSignature({ ...valid, signatureHeader: ` ts=${ts} , v1=${sign(`id:1320000001;request-id:${requestId};ts:${ts};`).toUpperCase()} ` })).toBe(true);
  });

  it("lower-cases an alphanumeric id and leaves absent parts out of the manifest", () => {
    expect(verifyMercadoPagoSignature({ ...valid, dataId: "ORD01ABC", signatureHeader: `ts=${ts},v1=${sign(`id:ord01abc;request-id:${requestId};ts:${ts};`)}` })).toBe(true);
    expect(verifyMercadoPagoSignature({ ...valid, requestId: null, signatureHeader: `ts=${ts},v1=${sign(`id:1320000001;ts:${ts};`)}` })).toBe(true);
    expect(verifyMercadoPagoSignature({ ...valid, dataId: null, signatureHeader: `ts=${ts},v1=${sign(`request-id:${requestId};ts:${ts};`)}` })).toBe(true);
  });

  it.each([
    ["another payment id", { dataId: "1320000002" }],
    ["another request id", { requestId: "00000000-0000-0000-0000-000000000000" }],
    ["another secret", { secret: "anothersyntheticsecret0123456789" }],
    ["a missing header", { signatureHeader: null }],
    ["an empty header", { signatureHeader: "" }],
    ["a header without v1", { signatureHeader: `ts=${ts}` }],
    ["a header without ts", { signatureHeader: `v1=${sign(`id:1320000001;request-id:${requestId};ts:${ts};`)}` }],
    ["a truncated digest", { signatureHeader: `ts=${ts},v1=${sign(`id:1320000001;request-id:${requestId};ts:${ts};`).slice(0, 32)}` }],
    ["a changed timestamp", { signatureHeader: `ts=1791850001,v1=${sign(`id:1320000001;request-id:${requestId};ts:${ts};`)}` }],
    ["a manifest-splitting request id", { requestId: `${requestId};ts:1` }],
    ["a manifest-splitting data id", { dataId: "1320000001;request-id:x" }],
  ])("rejects %s", (_label, override) => {
    expect(verifyMercadoPagoSignature({ ...valid, ...override })).toBe(false);
  });
});
