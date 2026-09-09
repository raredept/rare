import { randomUUID } from "node:crypto";
import type { EmailOutbox, PrismaClient } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { assertEmailRecipientAllowed, createSmtpEmailProvider, getSmtpEmailConfig } from "@/lib/smtp-email";
import { deliverTransactionalEmail, EmailDeliveryError, renderPaymentApprovedEmail, type EmailDeliveryResult, type TransactionalEmailProvider } from "@/lib/transactional-email";

const leaseMs = 5 * 60_000; // SMTP has a hard 45-second deadline.
const maxAttempts = 5;
type Database = Pick<PrismaClient, "$queryRaw" | "emailOutbox">;
type ClaimedEmail = EmailOutbox & { leaseToken: string };
type DeliveryDecision = Exclude<EmailDeliveryResult, { status: "disabled" }>;

export function createEmailOutboxRepository(db: Database) {
  return {
    async recoverAbandoned(now: Date) {
      const result = await db.emailOutbox.updateMany({
        where: { status: "sending", leaseExpiresAt: { lt: now } },
        data: { status: "uncertain", lastErrorCode: "WorkerLeaseExpired", leaseToken: null, leaseExpiresAt: null },
      });
      return result.count;
    },
    async claim(now: Date, sendNotBefore: Date): Promise<ClaimedEmail | null> {
      const token = randomUUID();
      const expiresAt = new Date(now.getTime() + leaseMs);
      // One atomic statement. Concurrent workers skip claimed rows. No SMTP
      // connection or long-running transaction holds the database lock.
      const rows = await db.$queryRaw<ClaimedEmail[]>`
        UPDATE "EmailOutbox"
        SET "status" = 'sending', "leaseToken" = ${token},
            "leaseExpiresAt" = ${expiresAt}, "attempts" = "attempts" + 1,
            "updatedAt" = ${now}
        WHERE "id" = (
          SELECT "id" FROM "EmailOutbox"
          WHERE "status" IN ('pending', 'retry') AND "nextAttemptAt" <= ${now}
            AND "createdAt" >= ${sendNotBefore}
          ORDER BY "nextAttemptAt", "createdAt", "id"
          LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `;
      return rows[0] ?? null;
    },
    async finish(row: ClaimedEmail, decision: DeliveryDecision, now: Date) {
      const exhausted = decision.status === "retry" && row.attempts >= maxAttempts;
      const status = exhausted ? "failed" : decision.status;
      const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, row.attempts - 1));
      const result = await db.emailOutbox.updateMany({
        where: { id: row.id, status: "sending", leaseToken: row.leaseToken },
        data: {
          status,
          provider: decision.provider,
          acceptedAt: status === "accepted" ? now : null,
          lastErrorCode: exhausted ? "RetryLimitReached" : decision.status === "accepted" ? null : decision.code,
          nextAttemptAt: status === "retry" ? new Date(now.getTime() + delay) : row.nextAttemptAt,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      // A late worker cannot overwrite a recovered or manually reviewed row.
      return result.count === 1 ? status : "uncertain";
    },
  };
}

export type EmailOutboxRepository = ReturnType<typeof createEmailOutboxRepository>;

export async function processEmailOutbox(options: {
  repository: EmailOutboxRepository;
  env?: Record<string, string | undefined>;
  provider?: TransactionalEmailProvider;
  batchSize?: number;
  now?: () => Date;
}) {
  const env = options.env ?? process.env;
  const summary = { disabled: false, claimed: 0, accepted: 0, retry: 0, failed: 0, uncertain: 0, abandoned: 0 };
  // Validate all environment/SMTP requirements before modifying the queue.
  const config = getSmtpEmailConfig(env);
  if (!config) return { ...summary, disabled: true };
  const now = options.now ?? (() => new Date());
  const batchSize = options.batchSize ?? 10;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("Invalid email batch size.");
  const provider = options.provider ?? createSmtpEmailProvider(config);
  summary.abandoned = await options.repository.recoverAbandoned(now());
  for (let index = 0; index < batchSize; index += 1) {
    const row = await options.repository.claim(now(), config.sendNotBefore);
    if (!row) break;
    summary.claimed += 1;
    let decision: DeliveryDecision;
    try {
      if (row.kind !== "payment_approved" || !Number.isInteger(row.totalInCents) || row.totalInCents < 0) {
        throw new EmailDeliveryError("failed", "InvalidEmailSnapshot");
      }
      const message = renderPaymentApprovedEmail({
        to: row.recipient ?? "",
        customerName: row.customerName ?? "Cliente RARE",
        orderNumber: row.orderNumber,
        total: formatMoney(row.totalInCents),
      });
      // Guard original value before template sanitization as well as adapter.
      assertEmailRecipientAllowed({ ...message, to: row.recipient ?? "" }, config);
      const result = await deliverTransactionalEmail(message, row.messageId, provider, env);
      decision = result.status === "disabled"
        ? { status: "failed", provider: "smtp", code: "EmailDisabledDuringAttempt" }
        : result;
    } catch (error) {
      decision = error instanceof EmailDeliveryError
        ? { status: error.outcome, provider: "smtp", code: error.code }
        : { status: "uncertain", provider: "smtp", code: "UnclassifiedWorkerFailure" };
    }
    // Persistence errors stop this worker; the sending lease becomes uncertain.
    // Payment was already committed and the message is not sent again blindly.
    const status = await options.repository.finish(row, decision, now());
    summary[status] += 1;
  }
  return summary;
}
