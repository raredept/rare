import { createHmac, timingSafeEqual } from "node:crypto";
import { MercadoPagoError, type MercadoPagoConfig } from "@/lib/mercadopago-config";

export {
  getMercadoPagoConfig,
  getMercadoPagoConfigurationIssue,
  isPixCheckoutAvailable,
  isPixEnabled,
  MercadoPagoError,
  type MercadoPagoConfig,
} from "@/lib/mercadopago-config";

// Mercado Pago Checkout API (payments API), Pix only. This module is the transport: order
// pricing, stock reservation and payment confirmation rules stay in src/lib/checkout.ts.
//
// The host is fixed on purpose: the access token is only ever sent to Mercado Pago's own API.
// Nothing derived from a response body or an error object is copied into an error: only fixed
// codes and the HTTP status.

export const MERCADOPAGO_API_ORIGIN = "https://api.mercadopago.com" as const;
export const MERCADOPAGO_REQUEST_TIMEOUT_MS = 15_000;
const maxResponseBytes = 256 * 1024;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
export type MercadoPagoRequestOptions = { fetchImpl?: FetchLike; timeoutMs?: number };

export type MercadoPagoPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  amountInCents: number | null;
  currency: string | null;
  externalReference: string | null;
  paymentMethodId: string | null;
  liveMode: boolean | null;
  pix: { copyPaste: string; qrCodeBase64: string | null; ticketUrl: string | null } | null;
};

function networkErrorCode(error: unknown) {
  const value = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = value?.cause?.code ?? value?.code;
  return typeof code === "string" ? code : undefined;
}

const beforeSendNetworkCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);

async function request(
  config: Pick<MercadoPagoConfig, "accessToken">,
  method: "GET" | "POST" | "PUT",
  path: string,
  init: { body?: unknown; idempotencyKey?: string } = {},
  options: MercadoPagoRequestOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? ((input: string, requestInit: RequestInit) => fetch(input, requestInit));
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? MERCADOPAGO_REQUEST_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await fetchImpl(`${MERCADOPAGO_API_ORIGIN}${path}`, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.accessToken}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      // A redirect must never replay the Authorization header somewhere else.
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await response.text();
    text = raw.length > maxResponseBytes ? raw.slice(0, maxResponseBytes) : raw;
  } catch (error) {
    if (timedOut) throw new MercadoPagoError("unknown", "MercadoPagoDeadlineExceeded");
    const code = networkErrorCode(error);
    // Never reached Mercado Pago, so nothing can have been created.
    if (code && beforeSendNetworkCodes.has(code)) throw new MercadoPagoError("rejected", "MercadoPagoUnreachable");
    throw new MercadoPagoError("unknown", "MercadoPagoResponseLost");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new MercadoPagoError("rejected", "MercadoPagoAuthenticationFailed", status);
    if (status === 404) throw new MercadoPagoError("rejected", "MercadoPagoNotFound", status);
    if (status === 408 || status === 409 || status === 429 || status >= 500) throw new MercadoPagoError("unknown", "MercadoPagoTemporarilyUnavailable", status);
    if (status >= 300 && status <= 399) throw new MercadoPagoError("unknown", "MercadoPagoUnexpectedRedirect", status);
    throw new MercadoPagoError("rejected", "MercadoPagoRejectedRequest", status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new MercadoPagoError("unknown", "MercadoPagoUnexpectedResponse", response.status);
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

export function normalizeMercadoPagoPayment(raw: unknown): MercadoPagoPayment {
  const value = raw as Record<string, unknown> | null;
  const id = typeof value?.id === "number" || typeof value?.id === "string" ? String(value.id) : "";
  const status = text(value?.status, 40);
  if (!/^\d{1,24}$/.test(id) || !status) throw new MercadoPagoError("unknown", "MercadoPagoUnexpectedResponse");
  const amount = value?.transaction_amount;
  const transaction = (value?.point_of_interaction as { transaction_data?: Record<string, unknown> } | undefined)?.transaction_data;
  const copyPaste = text(transaction?.qr_code, 2_000);
  const ticketUrl = text(transaction?.ticket_url, 2_000);
  return {
    id,
    status,
    statusDetail: text(value?.status_detail, 80),
    amountInCents: typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount * 100) : null,
    currency: text(value?.currency_id, 8)?.toLowerCase() ?? null,
    externalReference: text(value?.external_reference, 120),
    paymentMethodId: text(value?.payment_method_id, 40),
    liveMode: typeof value?.live_mode === "boolean" ? value.live_mode : null,
    pix: copyPaste
      ? {
          copyPaste,
          qrCodeBase64: text(transaction?.qr_code_base64, 60_000),
          ticketUrl: ticketUrl && /^https:\/\/[a-z0-9.-]*mercadopago\.com(\.br)?\//.test(ticketUrl) ? ticketUrl : null,
        }
      : null,
  };
}

// Mercado Pago expects a zoned timestamp. Brasília time has had a fixed -03:00 offset since 2019.
export function formatMercadoPagoDate(date: Date) {
  return new Date(date.getTime() - 3 * 60 * 60_000).toISOString().replace("Z", "-03:00");
}

export type PixPaymentInput = {
  orderId: string;
  orderNumber: string;
  totalInCents: number;
  // When Mercado Pago itself stops accepting the Pix. The store closes it earlier, at its own deadline.
  providerExpiresAt: Date;
  payer: { email: string; name: string | null; cpf: string };
  // Omitted outside https (local development): Mercado Pago only calls public https URLs.
  notificationUrl?: string;
};

export function buildPixPaymentRequest(input: PixPaymentInput) {
  if (!Number.isSafeInteger(input.totalInCents) || input.totalInCents <= 0) throw new MercadoPagoError("rejected", "InvalidPixAmount");
  const cpf = input.payer.cpf.replace(/\D/g, "");
  const [firstName, ...rest] = (input.payer.name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    transaction_amount: input.totalInCents / 100,
    description: `Pedido ${input.orderNumber} — RARE`,
    payment_method_id: "pix",
    external_reference: input.orderId,
    date_of_expiration: formatMercadoPagoDate(input.providerExpiresAt),
    ...(input.notificationUrl?.startsWith("https://") ? { notification_url: input.notificationUrl } : {}),
    payer: {
      email: input.payer.email,
      ...(firstName ? { first_name: firstName.slice(0, 60) } : {}),
      ...(rest.length ? { last_name: rest.join(" ").slice(0, 60) } : {}),
      identification: { type: "CPF", number: cpf },
    },
  };
}

export async function createPixPayment(config: MercadoPagoConfig, input: PixPaymentInput, options?: MercadoPagoRequestOptions) {
  const payment = normalizeMercadoPagoPayment(await request(config, "POST", "/v1/payments", {
    body: buildPixPaymentRequest(input),
    // Same key for the same order: a repeated request returns the same Pix instead of a second one.
    idempotencyKey: `rare-pix-${input.orderId}`,
  }, options));
  if (!payment.pix) throw new MercadoPagoError("unknown", "MercadoPagoPixDataMissing");
  return payment as MercadoPagoPayment & { pix: NonNullable<MercadoPagoPayment["pix"]> };
}

export async function getMercadoPagoPayment(config: MercadoPagoConfig, paymentId: string, options?: MercadoPagoRequestOptions) {
  if (!/^\d{1,24}$/.test(paymentId)) throw new MercadoPagoError("rejected", "InvalidMercadoPagoPaymentId");
  return normalizeMercadoPagoPayment(await request(config, "GET", `/v1/payments/${paymentId}`, {}, options));
}

/** Closes a Pix that was not paid. Mercado Pago refuses when the payment already left "pending". */
export async function cancelMercadoPagoPayment(config: MercadoPagoConfig, paymentId: string, options?: MercadoPagoRequestOptions) {
  if (!/^\d{1,24}$/.test(paymentId)) throw new MercadoPagoError("rejected", "InvalidMercadoPagoPaymentId");
  return normalizeMercadoPagoPayment(await request(config, "PUT", `/v1/payments/${paymentId}`, { body: { status: "cancelled" } }, options));
}

/** Finds the payments created for one order, newest first (recovery after a lost creation response). */
export async function findMercadoPagoPaymentsForOrder(config: MercadoPagoConfig, orderId: string, options?: MercadoPagoRequestOptions) {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(orderId)) throw new MercadoPagoError("rejected", "InvalidOrderReference");
  const query = new URLSearchParams({ external_reference: orderId, sort: "date_created", criteria: "desc", limit: "10" });
  const body = await request(config, "GET", `/v1/payments/search?${query.toString()}`, {}, options) as { results?: unknown } | null;
  if (!body || !Array.isArray(body.results)) throw new MercadoPagoError("unknown", "MercadoPagoUnexpectedResponse");
  return body.results.map(normalizeMercadoPagoPayment).filter((payment) => payment.externalReference === orderId);
}

/**
 * Verifies the `x-signature` header of a webhook notification: HMAC-SHA256 (hex) over
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` with the application's secret signature.
 * A part whose value is absent is left out of the manifest, as Mercado Pago does.
 *
 * There is deliberately no timestamp window: a replayed notification only makes the store read
 * the payment again from the API, which is authoritative, and processing is idempotent.
 */
export function verifyMercadoPagoSignature(input: { signatureHeader: string | null; requestId: string | null; dataId: string | null; secret: string }) {
  const parts = new Map<string, string>();
  for (const part of (input.signatureHeader ?? "").split(",")) {
    const separator = part.indexOf("=");
    if (separator > 0) parts.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const ts = parts.get("ts") ?? "";
  const v1 = (parts.get("v1") ?? "").toLowerCase();
  if (!/^\d{1,20}$/.test(ts) || !/^[a-f0-9]{64}$/.test(v1)) return false;
  const requestId = input.requestId?.trim() ?? "";
  if (requestId.length > 200 || /[;\r\n]/.test(requestId)) return false;
  const dataId = input.dataId?.trim() ?? "";
  if (dataId && !/^[A-Za-z0-9_-]{1,64}$/.test(dataId)) return false;
  const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest();
  const received = Buffer.from(v1, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
