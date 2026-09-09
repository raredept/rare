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
});
