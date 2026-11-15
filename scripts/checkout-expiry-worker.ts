import "dotenv/config";
import { runCheckoutExpiryBatch } from "../src/lib/checkout-expiry";
import { CHECKOUT_WORKER_POLL_MS } from "../src/lib/checkout-policy";
import { prisma } from "../src/lib/prisma";
import { getTransactionalEmailDriver } from "../src/lib/transactional-email";
import { getAsaasConfigurationIssue } from "../src/lib/asaas-config";

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
async function main() {
  console.log(JSON.stringify({ worker: "checkout-expiry", pollMs: CHECKOUT_WORKER_POLL_MS, durable: true, commitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null }));
  while (!stopping) {
    const started = Date.now();
    try {
      const batch = await runCheckoutExpiryBatch();
      if (batch.results.length) console.log(JSON.stringify({ at: new Date().toISOString(), ...batch }));
    } catch {
      console.error(JSON.stringify({ at: new Date().toISOString(), error: "EXPIRY_BATCH_FAILED_RETRYING" }));
    }
    // Asaas webhook inbox: events are stored by the route and applied here (and right after each
    // delivery). Needs only a usable Asaas configuration, whatever PAYMENT_PROVIDER says, so orders
    // created before a rollback to Stripe keep being reconciled.
    if (getAsaasConfigurationIssue() === null) {
      try {
        const { processAsaasWebhookEvents } = await import("../src/lib/asaas-webhook");
        const events = await processAsaasWebhookEvents({ limit: 25 });
        if (events.length) console.log(JSON.stringify({ at: new Date().toISOString(), asaasEvents: events.map((event) => event.outcome) }));
      } catch (error) {
        console.error(JSON.stringify({ at: new Date().toISOString(), asaas: "WEBHOOK_BATCH_FAILED", code: error instanceof Error ? error.name : "unknown" }));
      }
    }
    // Same process drains the e-mail outbox when SMTP is enabled (no-op while disabled).
    if (getTransactionalEmailDriver() !== "disabled") {
      try {
        const { createEmailOutboxRepository, processEmailOutbox } = await import("../src/lib/email-outbox-worker");
        const mail = await processEmailOutbox({ repository: createEmailOutboxRepository(prisma) });
        if (mail.claimed || mail.abandoned) console.log(JSON.stringify({ at: new Date().toISOString(), email: mail }));
      } catch (error) {
        console.error(JSON.stringify({ at: new Date().toISOString(), email: "OUTBOX_BATCH_FAILED", code: error instanceof Error ? error.name : "unknown" }));
      }
      // Support requests are persisted first; this retries their e-mails (team, then confirmation).
      try {
        const { processSupportRequests } = await import("../src/lib/support-requests");
        const support = await processSupportRequests(prisma, { limit: 10 });
        if (support.processed) console.log(JSON.stringify({ at: new Date().toISOString(), support }));
      } catch (error) {
        console.error(JSON.stringify({ at: new Date().toISOString(), support: "SUPPORT_BATCH_FAILED", code: error instanceof Error ? error.name : "unknown" }));
      }
    }
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) => setTimeout(resolve, Math.max(100, CHECKOUT_WORKER_POLL_MS - (Date.now() - started))));
  }
}
main().finally(() => prisma.$disconnect()).catch(() => { process.exitCode = 1; });
