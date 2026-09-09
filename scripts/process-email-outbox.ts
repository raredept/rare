import "dotenv/config";
import { EmailDeliveryError, getTransactionalEmailDriver } from "../src/lib/transactional-email";

async function main() {
  // Safe default also avoids connecting to a database or requiring migrations.
  if (getTransactionalEmailDriver() === "disabled") {
    console.log(JSON.stringify({ disabled: true, claimed: 0 }));
    return;
  }
  const { prisma } = await import("../src/lib/prisma");
  try {
    const { createEmailOutboxRepository, processEmailOutbox } = await import("../src/lib/email-outbox-worker");
    const result = await processEmailOutbox({ repository: createEmailOutboxRepository(prisma) });
    console.log(JSON.stringify(result)); // Counts only; no mailboxes or bodies.
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: error instanceof EmailDeliveryError ? error.code : "EmailOutboxWorkerFailed" }));
  process.exitCode = 1;
});
