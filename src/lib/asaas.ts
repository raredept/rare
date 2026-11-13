import { createHash, timingSafeEqual } from "node:crypto";
import packageJson from "../../package.json";
import { AsaasError, type AsaasConfig } from "@/lib/asaas-config";

export { AsaasError, getAsaasConfig, getAsaasConfigurationIssue, type AsaasConfig } from "@/lib/asaas-config";

// Asaas API v3 transport (customers, payments, Pix QR, refund, delete). Order pricing, stock and
// confirmation rules stay in src/lib/checkout-asaas.ts. The API key goes only to the fixed Asaas host
// of the configured environment, redirects are never followed, and nothing from a response body or
// an error object is copied into an error or a log: only fixed codes and the HTTP status.

export const ASAAS_REQUEST_TIMEOUT_MS = 15_000;
const maxResponseBytes = 256 * 1024;
const USER_AGENT = `RARE-Store/${packageJson.version} (Node.js)`;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export type AsaasRequestOptions = { fetchImpl?: FetchLike; timeoutMs?: number };

export type AsaasPaymentStatus =
  | "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | "RECEIVED_IN_CASH" | "REFUND_REQUESTED" | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED" | "CHARGEBACK_DISPUTE" | "AWAITING_CHARGEBACK_REVERSAL" | "DUNNING_REQUESTED" | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS" | "AUTHORIZED";

export type AsaasPayment = {
  id: string;
  status: string;
  billingType: string | null;
  amountInCents: number | null;
  customerId: string | null;
  externalReference: string | null;
  invoiceUrl: string | null;
  deleted: boolean;
};

export type AsaasPixQrCode = { copyPaste: string; qrCodeBase64: string | null; expiresAt: string | null };

// Sandbox also returns segmented ids such as pay_0_... . Keep path/query characters excluded.
const PAYMENT_ID = /^pay_[A-Za-z0-9_]{6,64}$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]{6,64}$/;
const ORDER_REFERENCE = /^[A-Za-z0-9_-]{8,120}$/;

function networkErrorCode(error: unknown) {
  const value = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = value?.cause?.code ?? value?.code;
  return typeof code === "string" ? code : undefined;
}

const beforeSendNetworkCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);

async function request(
  config: Pick<AsaasConfig, "apiBase" | "apiKey">,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  options: AsaasRequestOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? ASAAS_REQUEST_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await fetchImpl(`${config.apiBase}${path}`, {
      method,
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
        access_token: config.apiKey,
        // GET must have no body (Asaas answers 403 otherwise).
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await response.text();
    text = raw.length > maxResponseBytes ? raw.slice(0, maxResponseBytes) : raw;
  } catch (error) {
    if (timedOut) throw new AsaasError("unknown", "AsaasDeadlineExceeded");
    const code = networkErrorCode(error);
    if (code && beforeSendNetworkCodes.has(code)) throw new AsaasError("rejected", "AsaasUnreachable");
    throw new AsaasError("unknown", "AsaasResponseLost");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new AsaasError("rejected", "AsaasAuthenticationFailed", status);
    if (status === 404) throw new AsaasError("rejected", "AsaasNotFound", status);
    if (status === 408 || status === 409 || status === 429 || status >= 500) throw new AsaasError("unknown", "AsaasTemporarilyUnavailable", status);
    if (status >= 300 && status <= 399) throw new AsaasError("unknown", "AsaasUnexpectedRedirect", status);
    throw new AsaasError("rejected", "AsaasRejectedRequest", status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AsaasError("unknown", "AsaasUnexpectedResponse", response.status);
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

function toCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null;
}

export function normalizeAsaasPayment(raw: unknown): AsaasPayment {
  const value = raw as Record<string, unknown> | null;
  const id = text(value?.id, 80);
  const status = text(value?.status, 40);
  if (!id || !PAYMENT_ID.test(id) || !status) throw new AsaasError("unknown", "AsaasUnexpectedResponse");
  const invoiceUrl = text(value?.invoiceUrl, 2_000);
  return {
    id,
    status,
    billingType: text(value?.billingType, 30),
    amountInCents: toCents(value?.value),
    customerId: text(value?.customer, 80),
    externalReference: text(value?.externalReference, 200),
    // Only an Asaas-hosted https page is ever handed to the shopper.
    invoiceUrl: invoiceUrl && /^https:\/\/([a-z0-9-]+\.)*asaas\.com\//.test(invoiceUrl) ? invoiceUrl : null,
    deleted: value?.deleted === true,
  };
}

export function formatAsaasDate(date: Date) {
  // Calendar date in São Paulo (Brasília has had a fixed -03:00 offset since 2019).
  return new Date(date.getTime() - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

export async function findAsaasCustomerByReference(config: AsaasConfig, reference: string, options?: AsaasRequestOptions) {
  if (!ORDER_REFERENCE.test(reference)) throw new AsaasError("rejected", "InvalidCustomerReference");
  const query = new URLSearchParams({ externalReference: reference, limit: "10" });
  const body = (await request(config, "GET", `/customers?${query.toString()}`, undefined, options)) as { data?: unknown } | null;
  if (!body || !Array.isArray(body.data)) throw new AsaasError("unknown", "AsaasUnexpectedResponse");
  const match = body.data.find((item) => (item as { externalReference?: unknown; deleted?: unknown }).externalReference === reference && (item as { deleted?: unknown }).deleted !== true) as { id?: unknown } | undefined;
  const id = text(match?.id, 80);
  return id && CUSTOMER_ID.test(id) ? id : null;
}

/**
 * Minimum data the charge needs: name, CPF and e-mail. No address or phone is sent; the payer types
 * card holder details on Asaas's own page. Asaas's own notifications are disabled: the store e-mails.
 */
export async function createAsaasCustomer(
  config: AsaasConfig,
  input: { reference: string; name: string; cpf: string; email: string },
  options?: AsaasRequestOptions,
) {
  if (!ORDER_REFERENCE.test(input.reference)) throw new AsaasError("rejected", "InvalidCustomerReference");
  const cpf = input.cpf.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf)) throw new AsaasError("rejected", "InvalidCpf");
  const body = (await request(config, "POST", "/customers", {
    name: input.name.trim().slice(0, 100) || "Cliente RARE",
    cpfCnpj: cpf,
    email: input.email.trim().slice(0, 200),
    externalReference: input.reference,
    notificationDisabled: true,
  }, options)) as { id?: unknown } | null;
  const id = text(body?.id, 80);
  if (!id || !CUSTOMER_ID.test(id)) throw new AsaasError("unknown", "AsaasUnexpectedResponse");
  return id;
}

export type AsaasChargeInput = {
  customerId: string;
  orderId: string;
  orderNumber: string;
  totalInCents: number;
  method: "pix" | "card";
  dueDate: Date;
  successUrl?: string;
};

export function buildAsaasPaymentRequest(input: AsaasChargeInput) {
  if (!Number.isSafeInteger(input.totalInCents) || input.totalInCents <= 0) throw new AsaasError("rejected", "InvalidChargeAmount");
  if (!CUSTOMER_ID.test(input.customerId)) throw new AsaasError("rejected", "InvalidCustomer");
  if (!ORDER_REFERENCE.test(input.orderId)) throw new AsaasError("rejected", "InvalidOrderReference");
  return {
    customer: input.customerId,
    // Explicit method: UNDEFINED would let the shopper pick boleto, which outlives the stock hold.
    billingType: input.method === "pix" ? "PIX" : "CREDIT_CARD",
    value: input.totalInCents / 100,
    dueDate: formatAsaasDate(input.dueDate),
    description: `Pedido ${input.orderNumber} - RARE`.slice(0, 500),
    externalReference: input.orderId,
    ...(input.successUrl?.startsWith("https://") ? { callback: { successUrl: input.successUrl.slice(0, 255), autoRedirect: true } } : {}),
  };
}

/** Asaas has no idempotency key: the caller searches by externalReference before any retry. */
export async function createAsaasPayment(config: AsaasConfig, input: AsaasChargeInput, options?: AsaasRequestOptions) {
  return normalizeAsaasPayment(await request(config, "POST", "/payments", buildAsaasPaymentRequest(input), options));
}

export async function getAsaasPayment(config: AsaasConfig, paymentId: string, options?: AsaasRequestOptions) {
  if (!PAYMENT_ID.test(paymentId)) throw new AsaasError("rejected", "InvalidAsaasPaymentId");
  return normalizeAsaasPayment(await request(config, "GET", `/payments/${paymentId}`, undefined, options));
}

export async function getAsaasPixQrCode(config: AsaasConfig, paymentId: string, options?: AsaasRequestOptions): Promise<AsaasPixQrCode> {
  if (!PAYMENT_ID.test(paymentId)) throw new AsaasError("rejected", "InvalidAsaasPaymentId");
  const body = (await request(config, "GET", `/payments/${paymentId}/pixQrCode`, undefined, options)) as Record<string, unknown> | null;
  const copyPaste = text(body?.payload, 2_000);
  if (!copyPaste) throw new AsaasError("unknown", "AsaasPixDataMissing");
  const image = text(body?.encodedImage, 200_000);
  return { copyPaste, qrCodeBase64: image && /^[A-Za-z0-9+/=]+$/.test(image) ? image : null, expiresAt: text(body?.expirationDate, 40) };
}

/** Removes an unpaid charge so it can no longer be paid. Asaas refuses for a paid charge. */
export async function deleteAsaasPayment(config: AsaasConfig, paymentId: string, options?: AsaasRequestOptions) {
  if (!PAYMENT_ID.test(paymentId)) throw new AsaasError("rejected", "InvalidAsaasPaymentId");
  const body = (await request(config, "DELETE", `/payments/${paymentId}`, undefined, options)) as { deleted?: unknown } | null;
  return body?.deleted === true;
}

/** Full refund (Pix received or card confirmed/received). The outcome arrives by webhook. */
export async function refundAsaasPayment(config: AsaasConfig, paymentId: string, description: string, options?: AsaasRequestOptions) {
  if (!PAYMENT_ID.test(paymentId)) throw new AsaasError("rejected", "InvalidAsaasPaymentId");
  return normalizeAsaasPayment(await request(config, "POST", `/payments/${paymentId}/refund`, { description: description.slice(0, 200) }, options));
}

/** Charges created for one order, to recover after a lost creation response. */
export async function findAsaasPaymentsForOrder(config: AsaasConfig, orderId: string, options?: AsaasRequestOptions) {
  if (!ORDER_REFERENCE.test(orderId)) throw new AsaasError("rejected", "InvalidOrderReference");
  const query = new URLSearchParams({ externalReference: orderId, limit: "20" });
  const body = (await request(config, "GET", `/payments?${query.toString()}`, undefined, options)) as { data?: unknown } | null;
  if (!body || !Array.isArray(body.data)) throw new AsaasError("unknown", "AsaasUnexpectedResponse");
  return body.data.map(normalizeAsaasPayment).filter((payment) => payment.externalReference === orderId);
}

/**
 * Constant-time check of the `asaas-access-token` header against ASAAS_WEBHOOK_TOKEN. Both sides are
 * hashed first so the comparison never depends on the received length.
 */
export function verifyAsaasWebhookToken(received: string | null, expected: string) {
  if (!received || received.length > 512) return false;
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const ASAAS_PAYMENT_ID_PATTERN = PAYMENT_ID;
