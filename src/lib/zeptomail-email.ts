import { assertEmailRecipientAllowed } from "@/lib/smtp-email";
import type { ZeptoMailEmailConfig } from "@/lib/email-config";
import { EmailDeliveryError, type TransactionalEmailMessage, type TransactionalEmailProvider } from "@/lib/transactional-email";

// Transport for the Zoho ZeptoMail REST API (POST https://api.zeptomail.com/v1.1/email,
// `Authorization: Zoho-enczapikey <Send Mail token>`). Only the transport lives here: templates,
// allowlist policy, the outbox and its retries stay in the RARE code.
//
// Retry ownership: this layer performs NO retry. Every failure is classified once and the outbox
// (attempts, exponential backoff, five-attempt ceiling) is the only thing that repeats a send.
//
// Nothing derived from an error object, response body or the request is copied into an error:
// only fixed codes and, at most, a ZeptoMail error code that matches a strict pattern.

export const ZEPTOMAIL_REQUEST_TIMEOUT_MS = 15_000;
const maxResponseBytes = 64 * 1024;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

// The request either never reached ZeptoMail (DNS, refused, unreachable, connect timeout, TLS
// setup) or it may have been processed (reset, response timeout, abort). Only the first group is
// safe to repeat without risking a duplicate customer e-mail.
const beforeSendNetworkCodes = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT",
  "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT",
]);

function networkErrorCode(error: unknown) {
  const value = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = value?.cause?.code ?? value?.code;
  return typeof code === "string" ? code : undefined;
}

export function classifyZeptoMailNetworkError(error: unknown, timedOut: boolean): EmailDeliveryError {
  if (timedOut) return new EmailDeliveryError("uncertain", "ZeptoMailDeadlineExceeded");
  const code = networkErrorCode(error);
  if (code && beforeSendNetworkCodes.has(code)) return new EmailDeliveryError("retry", "ZeptoMailNetworkFailureBeforeSend");
  return new EmailDeliveryError("uncertain", "ZeptoMailAcceptanceUnknown");
}

function providerErrorCode(body: unknown) {
  const value = body as { error?: { code?: unknown; details?: Array<{ code?: unknown }> } } | null;
  const pattern = /^[A-Z]{2,6}_\d{1,4}$/;
  const parts = [value?.error?.code, value?.error?.details?.[0]?.code].filter((part): part is string => typeof part === "string" && pattern.test(part));
  return parts.length ? parts.join("/") : undefined;
}

export function classifyZeptoMailHttpStatus(status: number, body: unknown): EmailDeliveryError {
  const detail = providerErrorCode(body);
  if (status === 401) return new EmailDeliveryError("failed", "ZeptoMailAuthenticationFailed", detail);
  if (status === 402) return new EmailDeliveryError("failed", "ZeptoMailCreditsUnavailable", detail);
  if (status === 403) return new EmailDeliveryError("failed", "ZeptoMailForbidden", detail);
  if (status === 408 || status === 429) return new EmailDeliveryError("retry", status === 429 ? "ZeptoMailRateLimited" : "ZeptoMailRequestTimeout", detail);
  if (status >= 500 && status <= 599) return new EmailDeliveryError("retry", "ZeptoMailServerError", detail);
  if (status >= 300 && status <= 399) return new EmailDeliveryError("failed", "ZeptoMailUnexpectedRedirect", detail);
  return new EmailDeliveryError("failed", "ZeptoMailRejectedRequest", detail);
}

async function readBounded(response: Response) {
  const text = await response.text();
  return text.length > maxResponseBytes ? text.slice(0, maxResponseBytes) : text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Non-sensitive correlation id: derived from the outbox message id, never from order data.
export function zeptoMailClientReference(messageId: string) {
  const match = /^<rare-([a-f0-9]{64})@raredept\.com\.br>$/.exec(messageId);
  return match ? `rare-${match[1].slice(0, 32)}` : null;
}

export function buildZeptoMailRequest(message: TransactionalEmailMessage, messageId: string, config: Pick<ZeptoMailEmailConfig, "from" | "replyTo">) {
  const clientReference = zeptoMailClientReference(messageId);
  if (!clientReference) throw new EmailDeliveryError("failed", "InvalidEmailMessageId");
  const replyTo = message.replyTo ?? config.replyTo;
  return {
    from: { address: config.from, name: "RARE" },
    to: [{ email_address: { address: message.to } }],
    ...(replyTo ? { reply_to: [{ address: replyTo, name: "RARE" }] } : {}),
    subject: message.subject.replace(/[\r\n]/g, " "),
    textbody: message.text,
    htmlbody: message.html,
    client_reference: clientReference,
    track_clicks: false,
    track_opens: false,
  };
}

export function createZeptoMailEmailProvider(
  config: ZeptoMailEmailConfig,
  options: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): TransactionalEmailProvider & { name: "zeptomail" } {
  const fetchImpl = options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? ZEPTOMAIL_REQUEST_TIMEOUT_MS;
  return {
    name: "zeptomail",
    async send(message, messageId) {
      // Same guard as the SMTP transport: an address outside the staging allowlist never
      // produces a network call.
      assertEmailRecipientAllowed(message, config);
      const payload = buildZeptoMailRequest(message, messageId, config);
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      let response: Response;
      let text: string;
      try {
        response = await fetchImpl(config.endpoint, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: `Zoho-enczapikey ${config.sendToken}`,
          },
          body: JSON.stringify(payload),
          // A redirect must never replay the Authorization header somewhere else.
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
        });
        text = await readBounded(response);
      } catch (error) {
        throw classifyZeptoMailNetworkError(error, timedOut);
      } finally {
        clearTimeout(timer);
      }

      const body = parseJson(text);
      if (!response.ok) throw classifyZeptoMailHttpStatus(response.status, body);
      // A 2xx means ZeptoMail took the message. A body we cannot recognize is not proof either
      // way, so it is never retried blindly.
      const parsed = body as { data?: unknown; request_id?: unknown } | null;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.data) || parsed.data.length === 0) {
        throw new EmailDeliveryError("uncertain", "ZeptoMailUnexpectedResponse");
      }
      const requestId = typeof parsed.request_id === "string" && /^[A-Za-z0-9._-]{1,120}$/.test(parsed.request_id) ? parsed.request_id : null;
      return { id: requestId ? `zeptomail:${requestId}` : messageId };
    },
  };
}
