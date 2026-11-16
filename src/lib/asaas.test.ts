import { describe, expect, it, vi } from "vitest";
import {
  AsaasError,
  buildAsaasPaymentRequest,
  createAsaasCustomer,
  createAsaasPayment,
  deleteAsaasInstallment,
  deleteAsaasPayment,
  findAsaasPaymentsForOrder,
  getAsaasInstallment,
  getAsaasInstallmentOrDeleted,
  getAsaasPayment,
  getAsaasPixQrCode,
  normalizeAsaasInstallment,
  normalizeAsaasPayment,
  refundAsaasInstallment,
  refundAsaasPayment,
  verifyAsaasWebhookToken,
  type AsaasConfig,
} from "@/lib/asaas";

const config: AsaasConfig = { environment: "sandbox", apiBase: "https://api-sandbox.asaas.com/v3", apiKey: "$aact_hmlg_secret_value_for_tests_only", webhookToken: "t".repeat(40) };

function respond(status: number, body: unknown) {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
}

const paymentBody = {
  object: "payment", id: "pay_080225913252", customer: "cus_000005401844", value: 170, netValue: 168.3, billingType: "PIX", status: "PENDING",
  externalReference: "order_bf_000001", invoiceUrl: "https://sandbox.asaas.com/i/080225913252", deleted: false, description: "Pedido", cpfCnpj: "12345678909",
};

describe("Asaas transport", () => {
  it("authenticates with access_token + User-Agent, to the fixed host, never following redirects", async () => {
    const fetchImpl = respond(200, paymentBody);
    await getAsaasPayment(config, "pay_080225913252", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/payments/pay_080225913252");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.redirect).toBe("manual");
    const headers = init.headers as Record<string, string>;
    expect(headers.access_token).toBe(config.apiKey);
    expect(headers["user-agent"]).toMatch(/^RARE-Store\//);
    expect(headers.authorization).toBeUndefined();
  });

  it("normalizes only the fields the store needs and drops non-Asaas links", () => {
    expect(normalizeAsaasPayment(paymentBody)).toEqual({
      id: "pay_080225913252", status: "PENDING", billingType: "PIX", amountInCents: 17000, customerId: "cus_000005401844",
      externalReference: "order_bf_000001", invoiceUrl: "https://sandbox.asaas.com/i/080225913252", deleted: false,
      installmentId: null, installmentNumber: null,
    });
    expect(normalizeAsaasPayment({ ...paymentBody, invoiceUrl: "https://evil.example/pay" }).invoiceUrl).toBeNull();
    expect(normalizeAsaasPayment({ ...paymentBody, value: 19.99 }).amountInCents).toBe(1999);
    expect(() => normalizeAsaasPayment({ id: "x" })).toThrow(AsaasError);
  });

  it("accepts the segmented payment id returned by the real Sandbox across the payment lifecycle", async () => {
    const id = "pay_0_qa123456789abc";
    const body = { ...paymentBody, id };
    expect(normalizeAsaasPayment(body).id).toBe(id);
    await expect(createAsaasPayment(config, { customerId: body.customer, orderId: body.externalReference, orderNumber: "RARE-QA", totalInCents: 17000, method: "pix", dueDate: new Date("2026-11-13T15:00:00Z") }, { fetchImpl: respond(200, body) })).resolves.toMatchObject({ id });
    const read = respond(200, body);
    await expect(getAsaasPayment(config, id, { fetchImpl: read })).resolves.toMatchObject({ id });
    expect(read.mock.calls[0][0]).toBe(`${config.apiBase}/payments/${id}`);
    await expect(getAsaasPixQrCode(config, id, { fetchImpl: respond(200, { payload: "QA-SANDBOX" }) })).resolves.toMatchObject({ copyPaste: "QA-SANDBOX" });
    await expect(deleteAsaasPayment(config, id, { fetchImpl: respond(200, { deleted: true }) })).resolves.toBe(true);
    await expect(refundAsaasPayment(config, id, "QA", { fetchImpl: respond(200, { ...body, status: "REFUNDED" }) })).resolves.toMatchObject({ id, status: "REFUNDED" });
  });

  it("recovers a segmented payment id by reference after an uncertain creation response", async () => {
    const id = "pay_0_qa123456789abc";
    await expect(findAsaasPaymentsForOrder(config, paymentBody.externalReference, { fetchImpl: respond(200, { data: [{ ...paymentBody, id }] }) })).resolves.toEqual([expect.objectContaining({ id, amountInCents: 17000 })]);
  });

  it.each([
    [400, "rejected", "AsaasRejectedRequest"],
    [401, "rejected", "AsaasAuthenticationFailed"],
    [403, "rejected", "AsaasAuthenticationFailed"],
    [404, "rejected", "AsaasNotFound"],
    [429, "unknown", "AsaasTemporarilyUnavailable"],
    [500, "unknown", "AsaasTemporarilyUnavailable"],
    [503, "unknown", "AsaasTemporarilyUnavailable"],
    [302, "unknown", "AsaasUnexpectedRedirect"],
  ])("maps HTTP %i to %s/%s without copying the body", async (status, outcome, code) => {
    const fetchImpl = respond(status, { errors: [{ code: "invalid_x", description: "CPF 12345678909 inválido" }] });
    const error = await getAsaasPayment(config, "pay_080225913252", { fetchImpl }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AsaasError);
    expect(error).toMatchObject({ outcome, code, status });
    expect(String((error as Error).message)).not.toContain("12345678909");
  });

  it("treats a timeout as unknown (the charge may exist) and an unreachable host as rejected", async () => {
    const hanging = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    await expect(getAsaasPayment(config, "pay_080225913252", { fetchImpl: hanging, timeoutMs: 5 })).rejects.toMatchObject({ outcome: "unknown", code: "AsaasDeadlineExceeded" });
    const unreachable = vi.fn(async () => { throw Object.assign(new Error("dns"), { cause: { code: "ENOTFOUND" } }); });
    await expect(getAsaasPayment(config, "pay_080225913252", { fetchImpl: unreachable })).rejects.toMatchObject({ outcome: "rejected", code: "AsaasUnreachable" });
    const lost = vi.fn(async () => { throw Object.assign(new Error("reset"), { cause: { code: "ECONNRESET" } }); });
    await expect(getAsaasPayment(config, "pay_080225913252", { fetchImpl: lost })).rejects.toMatchObject({ outcome: "unknown", code: "AsaasResponseLost" });
  });

  it("rejects invalid ids before any request", async () => {
    const fetchImpl = respond(200, paymentBody);
    for (const id of ["../customers", "pay_", "pay_abc/../x", "pay_0_qa123456/../customers", "pay_0_qa123456%2Fcustomers", "pay_0_qa123456?limit=1", "cus_123456"]) {
      await expect(getAsaasPayment(config, id, { fetchImpl })).rejects.toMatchObject({ code: "InvalidAsaasPaymentId" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("builds the charge from server values only: explicit method, reais, São Paulo date, order reference", () => {
    expect(buildAsaasPaymentRequest({ customerId: "cus_000005401844", orderId: "order_bf_000001", orderNumber: "RARE-1", totalInCents: 17000, method: "pix", dueDate: new Date("2026-11-28T02:30:00Z") })).toEqual({
      customer: "cus_000005401844", billingType: "PIX", value: 170, dueDate: "2026-11-27", description: "Pedido RARE-1 - RARE", externalReference: "order_bf_000001",
    });
    expect(buildAsaasPaymentRequest({ customerId: "cus_000005401844", orderId: "order_bf_000001", orderNumber: "RARE-1", totalInCents: 17000, method: "card", dueDate: new Date("2026-11-27T15:00:00Z"), successUrl: "https://raredept.com.br/pedido/sucesso?pedido=x" }))
      .toMatchObject({ billingType: "CREDIT_CARD", callback: { successUrl: "https://raredept.com.br/pedido/sucesso?pedido=x", autoRedirect: true } });
    expect(() => buildAsaasPaymentRequest({ customerId: "cus_000005401844", orderId: "order_bf_000001", orderNumber: "x", totalInCents: 0, method: "pix", dueDate: new Date() })).toThrow("InvalidChargeAmount");
  });

  it("creates the payment with a POST body and no boleto option", async () => {
    const fetchImpl = respond(200, paymentBody);
    await createAsaasPayment(config, { customerId: "cus_000005401844", orderId: "order_bf_000001", orderNumber: "RARE-1", totalInCents: 17000, method: "pix", dueDate: new Date("2026-11-27T15:00:00Z") }, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/payments");
    expect(JSON.parse(String(init.body))).toMatchObject({ billingType: "PIX", value: 170 });
  });

  it("sends only name, CPF digits, e-mail and our reference when creating a customer", async () => {
    const fetchImpl = respond(200, { id: "cus_000005401844" });
    await expect(createAsaasCustomer(config, { reference: "customer_000001", name: "Ana Souza", cpf: "123.456.789-09", email: "ana@example.com" }, { fetchImpl })).resolves.toBe("cus_000005401844");
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toEqual({ name: "Ana Souza", cpfCnpj: "12345678909", email: "ana@example.com", externalReference: "customer_000001", notificationDisabled: true });
  });

  it("reads Pix QR data and validates the image", async () => {
    const fetchImpl = respond(200, { encodedImage: "iVBORw0KGgo=", payload: "00020101021226...", expirationDate: "2027-11-27 23:59:59" });
    await expect(getAsaasPixQrCode(config, "pay_080225913252", { fetchImpl })).resolves.toEqual({ copyPaste: "00020101021226...", qrCodeBase64: "iVBORw0KGgo=", expiresAt: "2027-11-27 23:59:59" });
    await expect(getAsaasPixQrCode(config, "pay_080225913252", { fetchImpl: respond(200, {}) })).rejects.toMatchObject({ code: "AsaasPixDataMissing" });
  });

  it("deletes, refunds and lists charges of one order", async () => {
    await expect(deleteAsaasPayment(config, "pay_080225913252", { fetchImpl: respond(200, { deleted: true, id: "pay_080225913252" }) })).resolves.toBe(true);
    const refund = respond(200, { ...paymentBody, status: "REFUND_REQUESTED" });
    await refundAsaasPayment(config, "pay_080225913252", "Estorno do pedido RARE-1", { fetchImpl: refund });
    expect(refund.mock.calls[0][0]).toBe("https://api-sandbox.asaas.com/v3/payments/pay_080225913252/refund");
    const list = respond(200, { data: [paymentBody, { ...paymentBody, id: "pay_999999999999", externalReference: "other_order_01" }] });
    await expect(findAsaasPaymentsForOrder(config, "order_bf_000001", { fetchImpl: list })).resolves.toHaveLength(1);
    expect(String(list.mock.calls[0][0])).toContain("externalReference=order_bf_000001");
  });

  it("compares the webhook token in constant time and rejects anything else", () => {
    expect(verifyAsaasWebhookToken(config.webhookToken, config.webhookToken)).toBe(true);
    expect(verifyAsaasWebhookToken(`${config.webhookToken}x`, config.webhookToken)).toBe(false);
    expect(verifyAsaasWebhookToken(null, config.webhookToken)).toBe(false);
    expect(verifyAsaasWebhookToken(config.apiKey, config.webhookToken)).toBe(false);
    expect(verifyAsaasWebhookToken("x".repeat(600), config.webhookToken)).toBe(false);
  });
});

describe("Asaas card installment contract (RARE-CARD-INSTALLMENTS-01)", () => {
  const base = { customerId: "cus_000005401844", orderId: "order_bf_000001", orderNumber: "RARE-1", method: "card" as const, dueDate: new Date("2026-11-27T15:00:00Z") };
  const planId = "5e1f7c2a-0b1d-4c3e-9f00-0000000000aa";

  it("1x: the current single-charge payload, with `value` only (no installment fields)", () => {
    const body = buildAsaasPaymentRequest({ ...base, totalInCents: 22000, installmentCount: 1 });
    expect(body).toMatchObject({ billingType: "CREDIT_CARD", value: 220, externalReference: "order_bf_000001" });
    expect(body).not.toHaveProperty("installmentCount");
    expect(body).not.toHaveProperty("totalValue");
    expect(body).toEqual(buildAsaasPaymentRequest({ ...base, totalInCents: 22000 }));
  });

  it("3x: CREDIT_CARD, 3 installments, exact total in totalValue, never `value` or installmentValue", () => {
    const body = buildAsaasPaymentRequest({ ...base, totalInCents: 22000, installmentCount: 3 });
    expect(body).toMatchObject({ billingType: "CREDIT_CARD", installmentCount: 3, totalValue: 220, externalReference: "order_bf_000001", customer: "cus_000005401844" });
    expect(body).not.toHaveProperty("value");
    expect(body).not.toHaveProperty("installmentValue");
  });

  it("6x: the financed total and the order reference", () => {
    expect(buildAsaasPaymentRequest({ ...base, totalInCents: 23980, installmentCount: 6 })).toMatchObject({ billingType: "CREDIT_CARD", installmentCount: 6, totalValue: 239.8, externalReference: "order_bf_000001" });
  });

  it("never sends late-payment interest or fine fields to price an installment plan", () => {
    const body = buildAsaasPaymentRequest({ ...base, totalInCents: 23980, installmentCount: 6 });
    expect(body).not.toHaveProperty("interest");
    expect(body).not.toHaveProperty("fine");
  });

  it("refuses installments on Pix and counts outside 1..21", () => {
    expect(() => buildAsaasPaymentRequest({ ...base, method: "pix", totalInCents: 22000, installmentCount: 2 })).toThrow("InvalidInstallmentCount");
    expect(() => buildAsaasPaymentRequest({ ...base, totalInCents: 22000, installmentCount: 0 })).toThrow("InvalidInstallmentCount");
    expect(() => buildAsaasPaymentRequest({ ...base, totalInCents: 22000, installmentCount: 22 })).toThrow("InvalidInstallmentCount");
  });

  it("reads the plan link of an installment payment and the plan itself", () => {
    expect(normalizeAsaasPayment({ ...paymentBody, billingType: "CREDIT_CARD", installment: planId, installmentNumber: 2 })).toMatchObject({ installmentId: planId, installmentNumber: 2 });
    expect(normalizeAsaasPayment({ ...paymentBody, installment: "../payments" }).installmentId).toBeNull();
    expect(normalizeAsaasInstallment({ object: "installment", id: planId, value: 239.8, paymentValue: 39.96, installmentCount: 6, billingType: "CREDIT_CARD", customer: "cus_000005401844", deleted: false })).toEqual({ id: planId, totalInCents: 23980, installmentCount: 6, billingType: "CREDIT_CARD", customerId: "cus_000005401844", deleted: false });
  });

  it("closes, reads and refunds a plan through its own endpoints", async () => {
    const del = respond(200, { deleted: true, id: planId });
    await expect(deleteAsaasInstallment(config, planId, { fetchImpl: del })).resolves.toBe(true);
    expect(del.mock.calls[0][0]).toBe(`https://api-sandbox.asaas.com/v3/installments/${planId}`);
    expect(del.mock.calls[0][1].method).toBe("DELETE");
    const refund = respond(200, { id: planId, value: 239.8, installmentCount: 6, billingType: "CREDIT_CARD", customer: "cus_000005401844" });
    await refundAsaasInstallment(config, planId, { fetchImpl: refund });
    expect(refund.mock.calls[0][0]).toBe(`https://api-sandbox.asaas.com/v3/installments/${planId}/refund`);
    // Full refund: no value is sent.
    expect(JSON.parse(String(refund.mock.calls[0][1].body))).toEqual({});
    await expect(getAsaasInstallmentOrDeleted(config, planId, { fetchImpl: respond(404, {}) })).resolves.toMatchObject({ id: planId, deleted: true, totalInCents: null });
    await expect(getAsaasInstallment(config, "../x", { fetchImpl: respond(200, {}) })).rejects.toThrow("InvalidAsaasInstallmentId");
  });
});
