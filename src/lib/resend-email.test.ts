import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEmailConfigurationIssue,
  getEmailConfigurationStatus,
  getEmailDeliveryConfig,
  getEmailReadiness,
  getResendEmailConfig,
  getSmtpEmailConfig,
  getZeptoMailEmailConfig,
  normalizeResendApiKey,
  type ResendEmailConfig,
} from "@/lib/email-config";
import { createEmailProvider } from "@/lib/email-outbox-worker";
import { buildResendRequest, classifyResendHttpStatus, createResendEmailProvider, resendIdempotencyKey } from "@/lib/resend-email";
import { deliverTransactionalEmail, EmailDeliveryError } from "@/lib/transactional-email";

// Synthetic values only. The "key" below is not a credential.
const API_KEY = ["re", "SyntheticCanary", "0123456789abcdef"].join("_");
const MESSAGE_ID = `<rare-${"ab12".repeat(16)}@raredept.com.br>`;
const baseEnv = {
  EMAIL_DRIVER: "resend",
  APP_ENV: "staging",
  EMAIL_DELIVERY_MODE: "test",
  EMAIL_TEST_RECIPIENTS: "qa@homologacao.example.org",
  RESEND_API_KEY: API_KEY,
  EMAIL_FROM_ORDERS: "contato@raredept.com.br",
  EMAIL_REPLY_TO: "suporte@raredept.com.br",
  EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
};
const config = getResendEmailConfig(baseEnv) as ResendEmailConfig;
const message = { kind: "payment_approved" as const, to: "qa@homologacao.example.org", subject: "Pagamento aprovado — pedido RARE-1", text: "Olá, Cliente. Total R$ 142,47.", html: "<p>Olá</p>" };

function jsonResponse(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const okBody = { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" };

async function failure(fetchImpl: (input: string, init: RequestInit) => Promise<Response>, timeoutMs?: number) {
  const provider = createResendEmailProvider(config, { fetchImpl, timeoutMs });
  try {
    await provider.send(message, MESSAGE_ID);
  } catch (error) {
    return error as EmailDeliveryError;
  }
  throw new Error("expected the send to fail");
}

afterEach(() => vi.restoreAllMocks());

describe("Resend configuration", () => {
  it("accepts a complete explicit configuration and always targets the official endpoint", () => {
    expect(config).toMatchObject({ driver: "resend", endpoint: "https://api.resend.com/emails", mode: "test", from: "contato@raredept.com.br" });
    expect(getEmailDeliveryConfig(baseEnv)?.driver).toBe("resend");
    expect(getEmailConfigurationStatus(baseEnv)).toBe("resend_configured_delivery_unverified");
    // No variable can move the API key to another host.
    expect(getResendEmailConfig({ ...baseEnv, RESEND_API_BASE: "https://evil.example.com", ZEPTOMAIL_API_BASE: "https://evil.example.com/v1.1" })?.endpoint).toBe("https://api.resend.com/emails");
  });

  it("accepts the key as pasted with or without the Bearer scheme", () => {
    expect(normalizeResendApiKey(`Bearer ${API_KEY}`)).toBe(API_KEY);
    expect(normalizeResendApiKey(`  ${API_KEY}\n`)).toBe(API_KEY);
    for (const bad of ["", "   ", "re_two words", "re_line\nbreak", `re_quote"${"a".repeat(12)}`, ["sk", "live", "notresend0123456789"].join("_"), "re_short", undefined]) {
      expect(normalizeResendApiKey(bad)).toBeNull();
    }
  });

  it.each([
    [{ RESEND_API_KEY: "" }, "MissingRESEND_API_KEY"],
    [{ RESEND_API_KEY: "has space" }, "InvalidResendApiKey"],
    [{ EMAIL_FROM_ORDERS: "" }, "MissingEMAIL_FROM_ORDERS"],
    [{ EMAIL_FROM_ORDERS: "RARE <contato@raredept.com.br>" }, "InvalidEmailMailbox"],
    [{ EMAIL_REPLY_TO: "a@b.com, c@d.com" }, "InvalidEmailMailbox"],
    [{ APP_ENV: "moon" }, "UnknownEmailEnvironment"],
    [{ APP_ENV: "production" }, "EmailEnvironmentModeMismatch"],
    [{ EMAIL_DELIVERY_MODE: "production" }, "EmailEnvironmentModeMismatch"],
    [{ EMAIL_TEST_RECIPIENTS: "" }, "InvalidEmailTestAllowlist"],
    [{ EMAIL_SEND_NOT_BEFORE: "" }, "MissingEMAIL_SEND_NOT_BEFORE"],
  ])("rejects %j with %s", (override, code) => {
    expect(getEmailConfigurationIssue({ ...baseEnv, ...override })).toBe(code);
    expect(getEmailConfigurationStatus({ ...baseEnv, ...override })).toBe("missing_required_configuration");
  });

  it("accepts a production environment only with production mode", () => {
    expect(getResendEmailConfig({ ...baseEnv, APP_ENV: "production", EMAIL_DELIVERY_MODE: "production", EMAIL_TEST_RECIPIENTS: "" })?.mode).toBe("production");
  });

  it("keeps the transports separate: no implicit driver and no fallback", () => {
    expect(() => getSmtpEmailConfig(baseEnv)).toThrow(/UnsupportedEmailDriver/);
    expect(() => getZeptoMailEmailConfig(baseEnv)).toThrow(/UnsupportedEmailDriver/);
    expect(() => getResendEmailConfig({ ...baseEnv, EMAIL_DRIVER: "zeptomail" })).toThrow(/UnsupportedEmailDriver/);
    // zeptomail selected but incomplete: a Resend key that happens to be present must not rescue it.
    expect(getEmailConfigurationStatus({ ...baseEnv, EMAIL_DRIVER: "zeptomail" })).toBe("missing_required_configuration");
    expect(createEmailProvider(config).name).toBe("resend");
  });

  it("reports admin readiness as enums and booleans only", () => {
    expect(getEmailReadiness(baseEnv)).toEqual({ driver: "resend", configured: true, deliveryMode: "test" });
    expect(getEmailReadiness({ ...baseEnv, RESEND_API_KEY: "" })).toEqual({ driver: "resend", configured: false, deliveryMode: "test" });
    expect(JSON.stringify(getEmailReadiness(baseEnv))).not.toMatch(new RegExp(`${API_KEY}|raredept|homologacao`));
  });
});

describe("Resend request", () => {
  it("maps the RARE message to the API without losing a field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    const result = await createResendEmailProvider(config, { fetchImpl }).send(message, MESSAGE_ID);

    expect(result).toEqual({ id: "resend:49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers).toMatchObject({
      authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
      "idempotency-key": `rare-${"ab12".repeat(16)}`,
    });
    expect((init.headers as Record<string, string>)["user-agent"]).toBeTruthy();
    expect(JSON.parse(init.body as string)).toEqual({
      from: "RARE <contato@raredept.com.br>",
      to: ["qa@homologacao.example.org"],
      reply_to: "suporte@raredept.com.br",
      subject: message.subject,
      text: message.text,
      html: message.html,
      tags: [{ name: "kind", value: "payment_approved" }],
    });
  });

  it("uses an idempotency key that is stable per message and carries no order data", () => {
    const key = resendIdempotencyKey(MESSAGE_ID);
    expect(key).toBe(`rare-${"ab12".repeat(16)}`);
    expect(key).toBe(resendIdempotencyKey(MESSAGE_ID));
    expect(key!.length).toBeLessThanOrEqual(256);
    expect(key).toMatch(/^rare-[a-f0-9]{64}$/);
    expect(resendIdempotencyKey("<rare-short@raredept.com.br>")).toBeNull();
    expect(resendIdempotencyKey("<forged@evil.example>")).toBeNull();
  });

  it("refuses a forged message id before any network call", async () => {
    const fetchImpl = vi.fn();
    const provider = createResendEmailProvider(config, { fetchImpl });
    await expect(provider.send(message, "<forged@evil.example>")).rejects.toMatchObject({ outcome: "failed", code: "InvalidEmailMessageId" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("prefers the reply-to of the message and strips line breaks from the subject", () => {
    const body = buildResendRequest({ ...message, replyTo: "cliente@example.org", subject: "Linha 1\r\nBcc: x@evil.example" }, config);
    expect(body.reply_to).toBe("cliente@example.org");
    expect(body.subject).not.toMatch(/[\r\n]/);
    expect(buildResendRequest(message, { from: "contato@raredept.com.br" })).not.toHaveProperty("reply_to");
  });

  it("makes zero network calls for a recipient outside the staging allowlist", async () => {
    const fetchImpl = vi.fn();
    const provider = createResendEmailProvider(config, { fetchImpl });
    await expect(provider.send({ ...message, to: "cliente.real@example.com" }, MESSAGE_ID)).rejects.toMatchObject({ code: "EmailRecipientNotAllowlisted" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Resend failure classification", () => {
  it.each([
    [400, { name: "validation_error" }, "failed", "ResendRejectedRequest"],
    [401, { name: "missing_api_key" }, "failed", "ResendAuthenticationFailed"],
    [403, { name: "validation_error" }, "failed", "ResendForbidden"],
    [404, { name: "not_found" }, "failed", "ResendRejectedRequest"],
    [408, {}, "retry", "ResendRequestTimeout"],
    [409, { name: "concurrent_idempotent_requests" }, "retry", "ResendConcurrentAttempt"],
    [409, { name: "invalid_idempotent_request" }, "uncertain", "ResendIdempotencyConflict"],
    [409, {}, "uncertain", "ResendIdempotencyConflict"],
    [422, { name: "missing_required_field" }, "failed", "ResendRejectedRequest"],
    [429, { name: "rate_limit_exceeded" }, "retry", "ResendRateLimited"],
    [429, {}, "retry", "ResendRateLimited"],
    [429, { name: "daily_quota_exceeded" }, "failed", "ResendQuotaExceeded"],
    [429, { name: "monthly_quota_exceeded" }, "failed", "ResendQuotaExceeded"],
    [500, { name: "application_error" }, "retry", "ResendServerError"],
    [503, { name: "service_unavailable" }, "retry", "ResendServerError"],
    [302, {}, "failed", "ResendUnexpectedRedirect"],
  ])("HTTP %i %j → %s %s", async (status, body, outcome, code) => {
    const error = await failure(async () => jsonResponse(status, body));
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect({ outcome: error.outcome, code: error.code }).toEqual({ outcome, code });
  });

  it("keeps only a strictly shaped provider error name and never the message text", async () => {
    const leaky = { statusCode: 403, name: "validation_error", message: `The key ${API_KEY} cannot send to qa@homologacao.example.org` };
    const error = await failure(async () => jsonResponse(403, leaky));
    expect(error.detail).toBe("validation_error");
    expect(JSON.stringify({ ...error, message: error.message })).not.toMatch(new RegExp(`${API_KEY}|homologacao`));
    expect(classifyResendHttpStatus(400, { name: "Bad Name; DROP TABLE" }).detail).toBeUndefined();
    expect(classifyResendHttpStatus(400, "not json").detail).toBeUndefined();
  });

  it("treats a 2xx without a recognizable id as uncertain, never as a blind retry", async () => {
    for (const body of [{}, { id: 42 }, { id: "x" }, "<html>ok</html>"]) {
      const error = await failure(async () => jsonResponse(200, body));
      expect({ outcome: error.outcome, code: error.code }).toEqual({ outcome: "uncertain", code: "ResendUnexpectedResponse" });
    }
  });

  it("retries a lost response, because the idempotency key makes the repeat safe", async () => {
    const dns = await failure(async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    });
    expect({ outcome: dns.outcome, code: dns.code }).toEqual({ outcome: "retry", code: "ResendNetworkFailureBeforeSend" });

    const reset = await failure(async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    });
    expect({ outcome: reset.outcome, code: reset.code }).toEqual({ outcome: "retry", code: "ResendResponseLost" });

    const slow = await failure((_input, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }), 5);
    expect({ outcome: slow.outcome, code: slow.code }).toEqual({ outcome: "retry", code: "ResendDeadlineExceeded" });
  });

  it("sends the same idempotency key again when the outbox repeats a message", async () => {
    const keys: string[] = [];
    const fetchImpl = vi.fn(async (_input: string, init: RequestInit) => {
      keys.push((init.headers as Record<string, string>)["idempotency-key"]);
      return keys.length === 1 ? jsonResponse(503, { name: "service_unavailable" }) : jsonResponse(200, okBody);
    });
    const provider = createResendEmailProvider(config, { fetchImpl });
    const first = await deliverTransactionalEmail(message, MESSAGE_ID, provider, baseEnv);
    const second = await deliverTransactionalEmail(message, MESSAGE_ID, provider, baseEnv);
    expect(first).toMatchObject({ status: "retry", provider: "resend", code: "ResendServerError", detail: "service_unavailable" });
    expect(second).toEqual({ status: "accepted", provider: "resend", id: "resend:49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("never puts the API key in an error, whatever fails", async () => {
    const errors = [
      await failure(async () => jsonResponse(401, { name: "missing_api_key", message: API_KEY })),
      await failure(async () => {
        throw new Error(`connect failed for Bearer ${API_KEY}`);
      }),
    ];
    for (const error of errors) expect(`${error.message} ${error.code} ${error.detail ?? ""} ${error.stack ?? ""}`).not.toContain(API_KEY);
  });
});
