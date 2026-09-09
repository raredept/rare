import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifySmtpError, createSmtpEmailProvider, createSmtpTransport, getSmtpEmailConfig } from "@/lib/smtp-email";
import { renderPaymentApprovedEmail } from "@/lib/transactional-email";

const smtp = vi.hoisted(() => ({ createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));

export const emailTestEnv = {
  EMAIL_DRIVER: "smtp", APP_ENV: "staging", EMAIL_DELIVERY_MODE: "test",
  EMAIL_TEST_RECIPIENTS: "controlled@example.com", EMAIL_SEND_NOT_BEFORE: "2026-09-07T00:00:00.000Z",
  SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_USER: "sender@example.com",
  SMTP_PASSWORD: "synthetic-test-password", EMAIL_FROM_ORDERS: "sender@example.com", EMAIL_REPLY_TO: "reply@example.com",
};
const message = renderPaymentApprovedEmail({ to: "controlled@example.com", customerName: "QA", orderNumber: "QA-1", total: "R$ 10,00" });
const messageId = `<rare-${"b".repeat(64)}@raredept.com.br>`;
const config = () => getSmtpEmailConfig(emailTestEnv)!;

beforeEach(() => { smtp.createTransport.mockReturnValue({ sendMail: vi.fn(), close: vi.fn() }); });
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("SMTP fail-closed configuration", () => {
  it("keeps an absent/disabled driver inert without SMTP configuration", () => {
    expect(getSmtpEmailConfig({})).toBeNull();
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
  it.each([
    { APP_ENV: "" }, { APP_ENV: "unknown" }, { EMAIL_DELIVERY_MODE: "production" },
    { EMAIL_TEST_RECIPIENTS: "" }, { EMAIL_TEST_RECIPIENTS: "*" }, { SMTP_HOST: "" },
    { SMTP_HOST: "https://smtp.example.com" }, { SMTP_PORT: "25" }, { SMTP_PASSWORD: "" },
    { EMAIL_FROM_ORDERS: "one@example.com,two@example.com" }, { EMAIL_SEND_NOT_BEFORE: "invalid" },
  ])("rejects incomplete or inconsistent configuration before transport creation: %o", (change) => {
    expect(() => getSmtpEmailConfig({ ...emailTestEnv, ...change })).toThrow();
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
  it("uses TLS with certificate validation on both supported ports", () => {
    createSmtpTransport(config());
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      secure: true, requireTLS: true, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
    }));
    createSmtpTransport(getSmtpEmailConfig({ ...emailTestEnv, SMTP_PORT: "587" })!);
    expect(smtp.createTransport).toHaveBeenLastCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
  });
});

describe("SMTP sending boundary", () => {
  it.each(["outside@example.com", "controlled@example.com,bcc@example.com", "controlled@example.com\r\nBcc: leak@example.com"])("blocks recipient %s without constructing transport", async (to) => {
    const provider = createSmtpEmailProvider(config());
    await expect(provider.send({ ...message, to }, messageId)).rejects.toMatchObject({ outcome: "failed" });
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
  it("fixes the envelope to one allowed mailbox and returns acceptance with stable Message-ID", async () => {
    const sendMail = vi.fn(async () => ({ accepted: [message.to], rejected: [], messageId }));
    const close = vi.fn();
    smtp.createTransport.mockReturnValueOnce({ sendMail, close });
    await expect(createSmtpEmailProvider(config()).send(message, messageId)).resolves.toEqual({ id: messageId });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ envelope: { from: "sender@example.com", to: [message.to] }, messageId }));
    expect(close).toHaveBeenCalled();
  });
  it("never treats an ambiguous disconnect as retryable or exposes the SMTP response", async () => {
    const error = Object.assign(new Error("secret raw provider response"), { code: "ECONNECTION", command: "DATA" });
    smtp.createTransport.mockReturnValueOnce({ sendMail: vi.fn(async () => { throw error; }), close: vi.fn() });
    await expect(createSmtpEmailProvider(config()).send(message, messageId)).rejects.toMatchObject({ outcome: "uncertain", code: "SmtpAcceptanceUnknown", message: "SmtpAcceptanceUnknown" });
  });
  it("bounds a stalled send and classifies the result as uncertain", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    smtp.createTransport.mockReturnValueOnce({ sendMail: vi.fn(() => new Promise(() => {})), close });
    const promise = createSmtpEmailProvider(config()).send(message, messageId);
    const assertion = expect(promise).rejects.toMatchObject({ outcome: "uncertain", code: "SmtpDeadlineExceeded" });
    await vi.advanceTimersByTimeAsync(45_001);
    await assertion;
    expect(close).toHaveBeenCalled();
  });
  it("distinguishes explicit rejection and errors known to precede DATA", () => {
    expect(classifySmtpError({ code: "EMESSAGE", command: "DATA", responseCode: 451 }).outcome).toBe("retry");
    expect(classifySmtpError({ code: "EMESSAGE", command: "DATA", responseCode: 550 }).outcome).toBe("failed");
    expect(classifySmtpError({ code: "ETIMEDOUT", command: "CONN" }).outcome).toBe("retry");
    expect(classifySmtpError({ code: "ETIMEDOUT" }).outcome).toBe("uncertain");
  });
});
