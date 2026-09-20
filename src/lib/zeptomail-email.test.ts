import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEmailConfigurationStatus,
  getEmailDeliveryConfig,
  getEmailReadiness,
  getSmtpEmailConfig,
  getZeptoMailEmailConfig,
  normalizeZeptoMailToken,
  type ZeptoMailEmailConfig,
} from "@/lib/email-config";
import { createEmailProvider, processEmailOutbox, type EmailDeliveryLog, type EmailOutboxRepository } from "@/lib/email-outbox-worker";
import { EmailDeliveryError } from "@/lib/transactional-email";
import { buildZeptoMailRequest, createZeptoMailEmailProvider, zeptoMailClientReference } from "@/lib/zeptomail-email";

// Synthetic values only. The "token" below is not a credential.
const TOKEN = "wSsVR-synthetic-send-mail-token-0123456789";
const MESSAGE_ID = `<rare-${"ab12".repeat(16)}@raredept.com.br>`;
const baseEnv = {
  EMAIL_DRIVER: "zeptomail",
  APP_ENV: "staging",
  EMAIL_DELIVERY_MODE: "test",
  EMAIL_TEST_RECIPIENTS: "qa@homologacao.example.org",
  ZEPTOMAIL_SEND_TOKEN: TOKEN,
  EMAIL_FROM_ORDERS: "orders@raredept.com.br",
  EMAIL_REPLY_TO: "support@raredept.com.br",
  EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
};
const config = getZeptoMailEmailConfig(baseEnv) as ZeptoMailEmailConfig;
const message = { kind: "payment_approved" as const, to: "qa@homologacao.example.org", subject: "Pagamento aprovado — pedido RARE-1", text: "Olá, Cliente. Total R$ 142,47.", html: "<p>Olá</p>" };

function jsonResponse(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const okBody = { data: [{ code: "EM_104", message: "Email request received" }], message: "OK", request_id: "req-123.abc" };

async function failure(fetchImpl: (input: string, init: RequestInit) => Promise<Response>, timeoutMs?: number) {
  const provider = createZeptoMailEmailProvider(config, { fetchImpl, timeoutMs });
  try {
    await provider.send(message, MESSAGE_ID);
  } catch (error) {
    return error as EmailDeliveryError;
  }
  throw new Error("expected the send to fail");
}

afterEach(() => vi.restoreAllMocks());

describe("ZeptoMail configuration", () => {
  it("accepts a complete explicit configuration and defaults to the official US endpoint", () => {
    expect(config).toMatchObject({ driver: "zeptomail", endpoint: "https://api.zeptomail.com/v1.1/email", mode: "test", from: "orders@raredept.com.br" });
    expect(getEmailDeliveryConfig(baseEnv)?.driver).toBe("zeptomail");
    expect(getEmailConfigurationStatus(baseEnv)).toBe("zeptomail_configured_delivery_unverified");
  });

  it("accepts the token as pasted with or without the Zoho-enczapikey scheme", () => {
    expect(normalizeZeptoMailToken(`Zoho-enczapikey ${TOKEN}`)).toBe(TOKEN);
    expect(normalizeZeptoMailToken(`  ${TOKEN}\n`)).toBe(TOKEN);
    for (const bad of ["", "   ", "two words", "line\nbreak", `quote"${TOKEN}`, undefined]) expect(normalizeZeptoMailToken(bad)).toBeNull();
  });

  it.each([
    [{ ZEPTOMAIL_SEND_TOKEN: "" }, "MissingZEPTOMAIL_SEND_TOKEN"],
    [{ ZEPTOMAIL_SEND_TOKEN: "has space" }, "InvalidZeptoMailSendToken"],
    [{ EMAIL_FROM_ORDERS: "" }, "MissingEMAIL_FROM_ORDERS"],
    [{ EMAIL_FROM_ORDERS: "not-an-address" }, "InvalidEmailMailbox"],
    [{ EMAIL_REPLY_TO: "a@b.com, c@d.com" }, "InvalidEmailMailbox"],
    [{ APP_ENV: "" }, "MissingAPP_ENV"],
    [{ APP_ENV: "moon" }, "UnknownEmailEnvironment"],
    [{ APP_ENV: "production" }, "EmailEnvironmentModeMismatch"],
    [{ EMAIL_DELIVERY_MODE: "production" }, "EmailEnvironmentModeMismatch"],
    [{ EMAIL_TEST_RECIPIENTS: "" }, "InvalidEmailTestAllowlist"],
    [{ EMAIL_TEST_RECIPIENTS: "a@b.com,not-an-address" }, "InvalidEmailTestAllowlist"],
    [{ EMAIL_SEND_NOT_BEFORE: "" }, "MissingEMAIL_SEND_NOT_BEFORE"],
    [{ EMAIL_SEND_NOT_BEFORE: "yesterday" }, "InvalidEmailSendNotBefore"],
  ])("rejects %j with %s", (override, code) => {
    let caught: unknown;
    try {
      getZeptoMailEmailConfig({ ...baseEnv, ...override });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EmailDeliveryError);
    expect((caught as EmailDeliveryError).code).toBe(code);
    expect(getEmailConfigurationStatus({ ...baseEnv, ...override })).toBe("missing_required_configuration");
  });

  it("accepts a production environment only with production mode", () => {
    expect(getZeptoMailEmailConfig({ ...baseEnv, APP_ENV: "production", EMAIL_DELIVERY_MODE: "production", EMAIL_TEST_RECIPIENTS: "" })?.mode).toBe("production");
  });

  it("only ever posts to official ZeptoMail API hosts over https", () => {
    expect(getZeptoMailEmailConfig({ ...baseEnv, ZEPTOMAIL_API_BASE: "https://api.zeptomail.eu/v1.1/" })?.endpoint).toBe("https://api.zeptomail.eu/v1.1/email");
    for (const base of ["http://api.zeptomail.com/v1.1", "https://evil.example.com/v1.1", "https://api.zeptomail.com.evil.io/v1.1", "https://api.zeptomail.com:8443/v1.1", "https://user:pw@api.zeptomail.com/v1.1", "https://api.zeptomail.com/v2", "https://api.zeptomail.com/v1.1?x=1", "not a url"]) {
      expect(() => getZeptoMailEmailConfig({ ...baseEnv, ZEPTOMAIL_API_BASE: base })).toThrow(/InvalidZeptoMailApiBase/);
    }
  });

  it("keeps the transports separate: no implicit driver, no fallback, smtp settings unchanged", () => {
    const smtpEnv = { ...baseEnv, EMAIL_DRIVER: "smtp", SMTP_HOST: "smtp.example.org", SMTP_PORT: "587", SMTP_USER: "orders@raredept.com.br", SMTP_PASSWORD: "synthetic" };
    expect(getSmtpEmailConfig(smtpEnv)).toMatchObject({ driver: "smtp", host: "smtp.example.org", port: 587 });
    expect(() => getSmtpEmailConfig(baseEnv)).toThrow(/UnsupportedEmailDriver/);
    expect(() => getZeptoMailEmailConfig(smtpEnv)).toThrow(/UnsupportedEmailDriver/);
    // smtp selected but incomplete: a ZeptoMail token that happens to be present must not rescue it.
    expect(getEmailConfigurationStatus({ ...baseEnv, EMAIL_DRIVER: "smtp" })).toBe("missing_required_configuration");
    expect(getEmailConfigurationStatus({ ...baseEnv, EMAIL_DRIVER: "sendgrid" })).toBe("missing_required_configuration");
    expect(getEmailConfigurationStatus({ EMAIL_DRIVER: "disabled" })).toBe("intentionally_disabled");
  });

  it("reports admin readiness as enums and booleans only", () => {
    expect(getEmailReadiness(baseEnv)).toEqual({ driver: "zeptomail", configured: true, deliveryMode: "test" });
    expect(getEmailReadiness({})).toEqual({ driver: "disabled", configured: false, deliveryMode: null });
    expect(getEmailReadiness({ ...baseEnv, ZEPTOMAIL_SEND_TOKEN: "" })).toEqual({ driver: "zeptomail", configured: false, deliveryMode: "test" });
    expect(getEmailReadiness({ EMAIL_DRIVER: "carrier-pigeon" }).driver).toBe("invalid");
    expect(JSON.stringify(getEmailReadiness(baseEnv))).not.toMatch(new RegExp(`${TOKEN}|raredept|homologacao`));
  });
});

describe("ZeptoMail request", () => {
  it("maps the RARE message to the API without losing a field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    const result = await createZeptoMailEmailProvider(config, { fetchImpl }).send(message, MESSAGE_ID);

    expect(result).toEqual({ id: "zeptomail:req-123.abc" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.zeptomail.com/v1.1/email");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(init.headers).toMatchObject({ authorization: `Zoho-enczapikey ${TOKEN}`, "content-type": "application/json", accept: "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      from: { address: "orders@raredept.com.br", name: "RARE" },
      to: [{ email_address: { address: "qa@homologacao.example.org" } }],
      reply_to: [{ address: "support@raredept.com.br", name: "RARE" }],
      subject: message.subject,
      textbody: message.text,
      htmlbody: message.html,
      client_reference: `rare-${"ab12".repeat(8)}`,
      track_clicks: false,
      track_opens: false,
    });
  });

  it("uses a client_reference that carries no order data, address, CPF or secret", () => {
    const reference = zeptoMailClientReference(MESSAGE_ID);
    expect(reference).toBe(`rare-${"ab12".repeat(8)}`);
    expect(reference).not.toMatch(/@|cpf|token/i);
    expect(zeptoMailClientReference("<rare-short@raredept.com.br>")).toBeNull();
    expect(() => buildZeptoMailRequest(message, "<forged@evil.example>", config)).toThrow(/InvalidEmailMessageId/);
  });

  it("omits reply_to when none is configured and strips header injection from the subject", () => {
    const request = buildZeptoMailRequest({ ...message, subject: "Assunto\r\nBcc: evil@example.com" }, MESSAGE_ID, { from: config.from, replyTo: undefined });
    expect(request).not.toHaveProperty("reply_to");
    expect(request.subject).not.toMatch(/[\r\n]/);
  });

  it("keeps UTF-8, accents and money formatting intact through the JSON body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    const text = "Olá, João — pagamento de R$ 1.234,50 recebido. ção ñ 日本";
    await createZeptoMailEmailProvider(config, { fetchImpl }).send({ ...message, subject: "Confirmação — R$ 1.234,50", text, html: `<p>${text}</p>` }, MESSAGE_ID);
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.subject).toBe("Confirmação — R$ 1.234,50");
    expect(body.textbody).toBe(text);
    expect(body.htmlbody).toBe(`<p>${text}</p>`);
  });

  it("falls back to the internal message id when request_id is missing or not a safe token", async () => {
    for (const requestId of [undefined, "has space", "x".repeat(200), 123]) {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ...okBody, request_id: requestId }));
      expect(await createZeptoMailEmailProvider(config, { fetchImpl }).send(message, MESSAGE_ID)).toEqual({ id: MESSAGE_ID });
    }
  });
});

describe("ZeptoMail failure classification", () => {
  it.each([
    [400, { error: { code: "TM_3201", details: [{ code: "GE_102", message: "Mandatory Field 'subject' was set as Empty Value" }] } }, "failed", "ZeptoMailRejectedRequest", "TM_3201/GE_102"],
    [400, { error: { code: "TM_4001", details: [{ code: "SM_111" }] } }, "failed", "ZeptoMailRejectedRequest", "TM_4001/SM_111"],
    [401, { error: { code: "TM_1401" } }, "failed", "ZeptoMailAuthenticationFailed", "TM_1401"],
    [402, { error: { code: "TM_5001", details: [{ code: "LE_102" }] } }, "failed", "ZeptoMailCreditsUnavailable", "TM_5001/LE_102"],
    [403, { error: { code: "TM_3601", details: [{ code: "AE_101" }] } }, "failed", "ZeptoMailForbidden", "TM_3601/AE_101"],
    [404, {}, "failed", "ZeptoMailRejectedRequest", undefined],
    [408, {}, "retry", "ZeptoMailRequestTimeout", undefined],
    [429, { error: { code: "TM_3601", details: [{ code: "SMI_115" }] } }, "retry", "ZeptoMailRateLimited", "TM_3601/SMI_115"],
    [500, {}, "retry", "ZeptoMailServerError", undefined],
    [502, "<html>bad gateway</html>", "retry", "ZeptoMailServerError", undefined],
    [503, {}, "retry", "ZeptoMailServerError", undefined],
    [504, "", "retry", "ZeptoMailServerError", undefined],
    [302, "", "failed", "ZeptoMailUnexpectedRedirect", undefined],
  ])("HTTP %s → %s (%s)", async (status, body, outcome, code, detail) => {
    const error = await failure(async () => jsonResponse(status, body));
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect({ outcome: error.outcome, code: error.code, detail: error.detail }).toEqual({ outcome, code, detail });
  });

  it("only forwards provider error codes that match the strict pattern", async () => {
    const error = await failure(async () => jsonResponse(400, { error: { code: `TM_3201 ${TOKEN}`, details: [{ code: "<script>alert(1)</script>" }] } }));
    expect(error.detail).toBeUndefined();
    expect(JSON.stringify([error.message, error.code, error.detail])).not.toContain(TOKEN);
  });

  it("aborts a stalled request at the explicit deadline and never retries it blindly", async () => {
    const stalled = (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    const started = Date.now();
    const error = await failure(stalled, 30);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect({ outcome: error.outcome, code: error.code }).toEqual({ outcome: "uncertain", code: "ZeptoMailDeadlineExceeded" });
  });

  it.each([
    ["ENOTFOUND", "retry", "ZeptoMailNetworkFailureBeforeSend"],
    ["EAI_AGAIN", "retry", "ZeptoMailNetworkFailureBeforeSend"],
    ["ECONNREFUSED", "retry", "ZeptoMailNetworkFailureBeforeSend"],
    ["UND_ERR_CONNECT_TIMEOUT", "retry", "ZeptoMailNetworkFailureBeforeSend"],
    ["ENETUNREACH", "retry", "ZeptoMailNetworkFailureBeforeSend"],
    ["ECONNRESET", "uncertain", "ZeptoMailAcceptanceUnknown"],
    ["UND_ERR_SOCKET", "uncertain", "ZeptoMailAcceptanceUnknown"],
    [undefined, "uncertain", "ZeptoMailAcceptanceUnknown"],
  ])("network error %s → %s", async (cause, outcome, code) => {
    const error = await failure(async () => {
      throw Object.assign(new TypeError(`fetch failed (${TOKEN})`), cause ? { cause: { code: cause } } : {});
    });
    expect({ outcome: error.outcome, code: error.code }).toEqual({ outcome, code });
    expect(JSON.stringify([error.message, error.code, error.detail, String(error.stack).split("\n")[0]])).not.toContain(TOKEN);
  });

  it.each([
    ["an empty object", {}],
    ["no data array", { message: "OK", request_id: "r1" }],
    ["an empty data array", { data: [], request_id: "r1" }],
    ["a bare string", '"ok"'],
    ["HTML", "<html>captive portal</html>"],
    ["an empty body", ""],
  ])("a 2xx with %s is uncertain, not accepted and not retried", async (_name, body) => {
    const error = await failure(async () => jsonResponse(200, body));
    expect({ outcome: error.outcome, code: error.code }).toEqual({ outcome: "uncertain", code: "ZeptoMailUnexpectedResponse" });
  });
});

describe("ZeptoMail secrecy and policy", () => {
  it("never puts the token in an error, whatever the failure", async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => jsonResponse(400, { error: { code: "TM_3201" }, echo: TOKEN }),
      async () => jsonResponse(401, `denied ${TOKEN}`),
      async () => jsonResponse(500, { echo: `Zoho-enczapikey ${TOKEN}` }),
      async () => jsonResponse(200, { echo: TOKEN }),
      async () => { throw new Error(`socket closed for Zoho-enczapikey ${TOKEN}`); },
    ];
    for (const run of cases) {
      const error = await failure(run);
      expect(JSON.stringify({ ...error, message: error.message, stack: error.stack?.split("\n")[0] })).not.toContain(TOKEN);
    }
  });

  it("makes zero HTTP calls for a recipient outside the staging allowlist", async () => {
    const fetchImpl = vi.fn();
    const provider = createZeptoMailEmailProvider(config, { fetchImpl });
    for (const to of ["cliente.real@example.com", "qa@homologacao.example.org.evil.io", "QA@homologacao.example.org, other@x.com"]) {
      await expect(provider.send({ ...message, to }, MESSAGE_ID)).rejects.toMatchObject({ outcome: "failed" });
    }
    await expect(provider.send({ ...message, to: "cliente.real@example.com" }, MESSAGE_ID)).rejects.toMatchObject({ code: "EmailRecipientNotAllowlisted" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("makes zero HTTP calls for a forged message id", async () => {
    const fetchImpl = vi.fn();
    await expect(createZeptoMailEmailProvider(config, { fetchImpl }).send(message, "<forged@evil.example>")).rejects.toMatchObject({ code: "InvalidEmailMessageId" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("outbox worker with the zeptomail driver", () => {
  const row = (kind: string, overrides: Record<string, unknown> = {}) => ({
    id: "e1", orderId: "order-internal-1", kind, recipient: "qa@homologacao.example.org", customerName: "João Ação", orderNumber: "RARE-20260920-XYZ123", totalInCents: 14247,
    messageId: MESSAGE_ID, status: "sending", attempts: 2, nextAttemptAt: new Date(), leaseToken: "lease", leaseExpiresAt: new Date(), provider: null, acceptedAt: null,
    lastErrorCode: null, reviewedAt: null, reviewNote: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  });
  const repository = (claimed: unknown[]) => {
    const queue = [...claimed];
    return {
      recoverAbandoned: vi.fn().mockResolvedValue(0),
      claim: vi.fn().mockImplementation(async () => queue.shift() ?? null),
      finish: vi.fn().mockImplementation(async (_row: unknown, decision: { status: string }) => decision.status),
    } as unknown as EmailOutboxRepository & { claim: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn> };
  };

  it.each([
    ["payment_approved", /Pagamento aprovado/, /confirmado/],
    ["order_shipped", /Pedido enviado/, /enviado/],
  ])("delivers %s over HTTPS with the RARE template and logs a sanitized event", async (kind, subject, text) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    vi.stubGlobal("fetch", fetchMock);
    const db = repository([row(kind)]);
    const events: EmailDeliveryLog[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const summary = await processEmailOutbox({ repository: db, env: baseEnv, log: (event) => events.push(event) });

    expect(summary).toMatchObject({ claimed: 1, accepted: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.subject).toMatch(subject);
    expect(body.textbody).toMatch(text);
    expect(body.htmlbody).toContain("Olá, João Ação");
    expect(body.textbody).toContain("142,47");
    expect(body.htmlbody).toContain("RARE-20260920-XYZ123");
    expect(db.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "accepted", provider: "zeptomail" }), expect.any(Date));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ provider: "zeptomail", messageKind: kind, attempt: 2, status: "accepted", code: null, providerRequestId: "req-123.abc" });
    expect(events[0].order).toMatch(/^[a-f0-9]{12}$/);
    const serialized = JSON.stringify([events, logSpy.mock.calls]);
    for (const secret of [TOKEN, "qa@homologacao", "João", "RARE-20260920", "order-internal-1", "Authorization"]) expect(serialized).not.toContain(secret);
    vi.unstubAllGlobals();
  });

  it("never calls ZeptoMail for a recipient outside the allowlist and records the same failure code as SMTP", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const db = repository([row("payment_approved", { recipient: "cliente.real@example.com" })]);
    const summary = await processEmailOutbox({ repository: db, env: baseEnv, log: () => undefined });
    expect(summary).toMatchObject({ claimed: 1, failed: 1, accepted: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "failed", code: "EmailRecipientNotAllowlisted" }), expect.any(Date));
    vi.unstubAllGlobals();
  });

  it("hands the configured backlog cutoff to the claim and calls nothing when the queue is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const db = repository([]);
    await processEmailOutbox({ repository: db, env: { ...baseEnv, EMAIL_SEND_NOT_BEFORE: "2026-09-20T01:30:00Z" }, log: () => undefined });
    expect(db.claim).toHaveBeenCalledWith(expect.any(Date), new Date("2026-09-20T01:30:00Z"));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does nothing while disabled and refuses to start on a bad configuration before claiming", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const db = repository([row("payment_approved")]);
    expect(await processEmailOutbox({ repository: db, env: { ...baseEnv, EMAIL_DRIVER: "disabled" } })).toMatchObject({ disabled: true, claimed: 0 });
    await expect(processEmailOutbox({ repository: db, env: { ...baseEnv, ZEPTOMAIL_SEND_TOKEN: "" } })).rejects.toThrow(/MissingZEPTOMAIL_SEND_TOKEN/);
    expect(db.claim).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("gives the outbox sole control of retries: one HTTP call per claim, backoff decided by the repository, no SMTP fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    vi.stubGlobal("fetch", fetchMock);
    const transport = vi.spyOn(nodemailer, "createTransport");
    const smtpToo = { ...baseEnv, SMTP_HOST: "smtp.example.org", SMTP_PORT: "587", SMTP_USER: "orders@raredept.com.br", SMTP_PASSWORD: "synthetic" };
    const db = repository([row("payment_approved")]);
    const events: EmailDeliveryLog[] = [];

    const summary = await processEmailOutbox({ repository: db, env: smtpToo, log: (event) => events.push(event) });

    expect(summary).toMatchObject({ claimed: 1, retry: 1, accepted: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(transport).not.toHaveBeenCalled();
    expect(db.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "retry", code: "ZeptoMailServerError" }), expect.any(Date));
    expect(events[0]).toMatchObject({ status: "retry", code: "ZeptoMailServerError", providerRequestId: null });
    vi.unstubAllGlobals();
  });

  it("selects the transport strictly from EMAIL_DRIVER", () => {
    const smtp = getEmailDeliveryConfig({ ...baseEnv, EMAIL_DRIVER: "smtp", SMTP_HOST: "smtp.example.org", SMTP_PORT: "465", SMTP_USER: "orders@raredept.com.br", SMTP_PASSWORD: "synthetic" });
    expect(createEmailProvider(smtp!).name).toBe("smtp");
    expect(createEmailProvider(config).name).toBe("zeptomail");
  });
});
