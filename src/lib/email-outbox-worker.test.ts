import { describe, expect, it, vi } from "vitest";
import { processEmailOutbox, type EmailOutboxRepository } from "@/lib/email-outbox-worker";
import { getEmailConfigurationStatus } from "@/lib/email-config";
import { validateEnvironment } from "@/lib/env";

function repository(): EmailOutboxRepository {
  return { recoverAbandoned: vi.fn(), claim: vi.fn(), finish: vi.fn() };
}

describe("email worker and readiness", () => {
  it("disabled does not touch the queue or provider", async () => {
    const db = repository();
    const provider = { name: "smtp", send: vi.fn() };
    expect(await processEmailOutbox({ repository: db, provider, env: {} })).toMatchObject({ disabled: true, claimed: 0 });
    expect(db.recoverAbandoned).not.toHaveBeenCalled();
    expect(db.claim).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("bad SMTP configuration blocks before claiming and readiness never claims delivery", async () => {
    const db = repository();
    const env = { EMAIL_DRIVER: "smtp", APP_ENV: "staging" };
    await expect(processEmailOutbox({ repository: db, env })).rejects.toThrow();
    expect(db.claim).not.toHaveBeenCalled();
    expect(getEmailConfigurationStatus(env)).toBe("missing_required_configuration");
    expect(validateEnvironment({ env, requireDatabase: false, requireAdminAuth: false, requireStorage: false }).errors).toContainEqual(expect.objectContaining({ variable: "EMAIL_DRIVER" }));
    expect(getEmailConfigurationStatus({ EMAIL_DRIVER: "disabled" })).toBe("intentionally_disabled");
  });
  const testEnv = {
    EMAIL_DRIVER: "smtp", APP_ENV: "staging", EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENTS: "qa@homologacao.example.org",
    SMTP_HOST: "smtp.example.org", SMTP_PORT: "465", SMTP_USER: "orders@raredept.com.br", SMTP_PASSWORD: "app-password-not-logged",
    EMAIL_FROM_ORDERS: "orders@raredept.com.br", EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
  };
  const row = (kind: string) => ({ id: "e1", orderId: "o1", kind, recipient: "qa@homologacao.example.org", customerName: "Cliente", orderNumber: "RARE-1", totalInCents: 12900, messageId: "<rare-a@raredept.com.br>", attempts: 1, leaseToken: "t", nextAttemptAt: new Date() });

  it.each([
    ["payment_approved", /Pagamento aprovado/],
    ["order_shipped", /Pedido enviado/],
  ])("renders the %s message and hands only the allowlisted recipient to SMTP", async (kind, subject) => {
    const db = repository();
    (db.claim as ReturnType<typeof vi.fn>).mockResolvedValueOnce(row(kind)).mockResolvedValueOnce(null);
    (db.finish as ReturnType<typeof vi.fn>).mockResolvedValue("accepted");
    const provider = { name: "smtp", send: vi.fn().mockResolvedValue({ id: "smtp-1" }) };

    const result = await processEmailOutbox({ repository: db, provider, env: testEnv });

    expect(result).toMatchObject({ claimed: 1, accepted: 1 });
    expect(provider.send).toHaveBeenCalledTimes(1);
    const [message] = provider.send.mock.calls[0];
    expect(message.subject).toMatch(subject);
    expect(message.to).toBe("qa@homologacao.example.org");
    expect(JSON.stringify(message)).not.toContain("app-password-not-logged");
  });

  it("refuses to send to a recipient outside the staging allowlist", async () => {
    const db = repository();
    (db.claim as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...row("payment_approved"), recipient: "cliente.real@example.com" }).mockResolvedValueOnce(null);
    (db.finish as ReturnType<typeof vi.fn>).mockResolvedValue("failed");
    const provider = { name: "smtp", send: vi.fn() };

    await processEmailOutbox({ repository: db, provider, env: testEnv });

    expect(provider.send).not.toHaveBeenCalled();
    expect(db.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "failed", code: "EmailRecipientNotAllowlisted" }), expect.any(Date));
  });

  it("fails an unknown message kind instead of sending a wrong template", async () => {
    const db = repository();
    (db.claim as ReturnType<typeof vi.fn>).mockResolvedValueOnce(row("marketing_blast")).mockResolvedValueOnce(null);
    (db.finish as ReturnType<typeof vi.fn>).mockResolvedValue("failed");
    const provider = { name: "smtp", send: vi.fn() };

    await processEmailOutbox({ repository: db, provider, env: testEnv });

    expect(provider.send).not.toHaveBeenCalled();
    expect(db.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: "InvalidEmailSnapshot" }), expect.any(Date));
  });
});
