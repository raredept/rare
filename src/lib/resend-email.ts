import { assertEmailRecipientAllowed } from "@/lib/smtp-email";
import type { ResendEmailConfig } from "@/lib/email-config";
import { EmailDeliveryError, type TransactionalEmailMessage, type TransactionalEmailProvider } from "@/lib/transactional-email";

// Transport for the Resend REST API (POST https://api.resend.com/emails,
// `Authorization: Bearer <API key>`). Only the transport lives here: templates, allowlist
// policy, the outbox and its retries stay in the RARE code.
//
// Retry ownership: this layer performs NO retry. Every failure is classified once and the outbox
// (attempts, exponential backoff, five-attempt ceiling) is the only thing that repeats a send.
//
// Every request carries an Idempotency-Key derived from the outbox message id. Resend keeps it
// for 24 hours and answers a repeat of the same message with the original result, so a lost
// response is retried by the outbox instead of being parked for manual review.
//
// Nothing derived from an error object, response body or the request is copied into an error:
// only fixed codes and, at most, a Resend error name that matches a strict pattern.

export const RESEND_REQUEST_TIMEOUT_MS = 15_000;
const maxResponseBytes = 64 * 1024;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const beforeSendNetworkCodes = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT",
  "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT",
]);

function networkErrorCode(error: unknown) {
  const value = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = value?.cause?.code ?? value?.code;
  return typeof code === "string" ? code : undefined;
}

export function classifyResendNetworkError(error: unknown, timedOut: boolean): EmailDeliveryError {
  if (timedOut) return new EmailDeliveryError("retry", "ResendDeadlineExceeded");
  const code = networkErrorCode(error);
  return new EmailDeliveryError("retry", code && beforeSendNetworkCodes.has(code) ? "ResendNetworkFailureBeforeSend" : "ResendResponseLost");
}

function providerErrorName(body: unknown) {
  const value = body as { name?: unknown; error?: { name?: unknown } } | null;
  const name = value?.name ?? value?.error?.name;
  return typeof name === "string" && /^[a-z][a-z_]{2,47}$/.test(name) ? name : undefined;
}

export function classifyResendHttpStatus(status: number, body: unknown): EmailDeliveryError {
  const detail = providerErrorName(body);
  if (status === 401) return new EmailDeliveryError("failed", "ResendAuthenticationFailed", detail);
  // Suspended or inactive key, sender domain not verified, or a test-mode recipient.
  if (status === 403) return new EmailDeliveryError("failed", "ResendForbidden", detail);
  if (status === 409) {
    // Another attempt with this key is still in flight: wait for it. Any other conflict means the
    // key was already used with a different body, so an earlier attempt may have been accepted.
    return detail === "concurrent_idempotent_requests"
      ? new EmailDeliveryError("retry", "ResendConcurrentAttempt", detail)
      : new EmailDeliveryError("uncertain", "ResendIdempotencyConflict", detail);
  }
  if (status === 429) {
    // A spent daily or monthly quota does not recover within the outbox backoff window.
    return detail === "daily_quota_exceeded" || detail === "monthly_quota_exceeded"
      ? new EmailDeliveryError("failed", "ResendQuotaExceeded", detail)
      : new EmailDeliveryError("retry", "ResendRateLimited", detail);
  }
  if (status === 408) return new EmailDeliveryError("retry", "ResendRequestTimeout", detail);
  if (status >= 500 && status <= 599) return new EmailDeliveryError("retry", "ResendServerError", detail);
  if (status >= 300 && status <= 399) return new EmailDeliveryError("failed", "ResendUnexpectedRedirect", detail);
  return new EmailDeliveryError("failed", "ResendRejectedRequest", detail);
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

// Non-sensitive and stable per outbox message: derived from the message id, never from order data.
export function resendIdempotencyKey(messageId: string) {
  const match = /^<rare-([a-f0-9]{64})@raredept\.com\.br>$/.exec(messageId);
  return match ? `rare-${match[1]}` : null;
}

export function buildResendRequest(message: TransactionalEmailMessage, config: Pick<ResendEmailConfig, "from" | "replyTo">) {
  const replyTo = message.replyTo ?? config.replyTo;
  return {
    from: `RARE <${config.from}>`,
    to: [message.to],
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject: message.subject.replace(/[\r\n]/g, " "),
    text: message.text,
    html: message.html,
    tags: [{ name: "kind", value: message.kind }],
  };
}

export function createResendEmailProvider(
  config: ResendEmailConfig,
  options: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): TransactionalEmailProvider & { name: "resend" } {
  const fetchImpl = options.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? RESEND_REQUEST_TIMEOUT_MS;
  return {
    name: "resend",
    async send(message, messageId) {
      // Same guard as the other transports: an address outside the staging allowlist never
      // produces a network call.
      assertEmailRecipientAllowed(message, config);
      const idempotencyKey = resendIdempotencyKey(messageId);
      if (!idempotencyKey) throw new EmailDeliveryError("failed", "InvalidEmailMessageId");
      const payload = buildResendRequest(message, config);
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
            authorization: `Bearer ${config.apiKey}`,
            "idempotency-key": idempotencyKey,
            // Resend rejects requests without a User-Agent.
            "user-agent": "rare-store-email/1",
          },
          body: JSON.stringify(payload),
          // A redirect must never replay the Authorization header somewhere else.
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
        });
        text = await readBounded(response);
      } catch (error) {
        throw classifyResendNetworkError(error, timedOut);
      } finally {
        clearTimeout(timer);
      }

      const body = parseJson(text);
      if (!response.ok) throw classifyResendHttpStatus(response.status, body);
      // A 2xx means Resend took the message. A body we cannot recognize is not proof either way,
      // so it is never retried blindly.
      const id = (body as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || !/^[A-Za-z0-9-]{8,80}$/.test(id)) {
        throw new EmailDeliveryError("uncertain", "ResendUnexpectedResponse");
      }
      return { id: `resend:${id}` };
    },
  };
}
