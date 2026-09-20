import "dotenv/config";
import { runCheckoutExpiryBatch } from "../src/lib/checkout-expiry";
import { CHECKOUT_WORKER_POLL_MS } from "../src/lib/checkout-policy";
import { prisma } from "../src/lib/prisma";
import { getTransactionalEmailDriver } from "../src/lib/transactional-email";

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
    // Same process drains the e-mail outbox when SMTP is enabled (no-op while disabled).
    if (getTransactionalEmailDriver() !== "disabled") {
      try {
        const { createEmailOutboxRepository, processEmailOutbox } = await import("../src/lib/email-outbox-worker");
        const mail = await processEmailOutbox({ repository: createEmailOutboxRepository(prisma) });
        if (mail.claimed || mail.abandoned) console.log(JSON.stringify({ at: new Date().toISOString(), email: mail }));
      } catch (error) {
        console.error(JSON.stringify({ at: new Date().toISOString(), email: "OUTBOX_BATCH_FAILED", code: error instanceof Error ? error.name : "unknown" }));
      }
    }
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) => setTimeout(resolve, Math.max(100, CHECKOUT_WORKER_POLL_MS - (Date.now() - started))));
  }
}
main().finally(() => prisma.$disconnect()).catch(() => { process.exitCode = 1; });
