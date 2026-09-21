import { randomUUID } from "node:crypto";
import type { EmailOutbox, PrismaClient } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { createHash } from "node:crypto";
import { getEmailDeliveryConfig, type EmailDeliveryConfig } from "@/lib/email-config";
import { assertEmailRecipientAllowed, createSmtpEmailProvider } from "@/lib/smtp-email";
import { createZeptoMailEmailProvider } from "@/lib/zeptomail-email";
import { deliverTransactionalEmail, EmailDeliveryError, renderOrderShippedEmail, renderPaymentApprovedEmail, type EmailDeliveryResult, type TransactionalEmailProvider } from "@/lib/transactional-email";

const leaseMs = 5 * 60_000; // SMTP has a hard 45-second deadline.
const maxAttempts = 5;
type Database = Pick<PrismaClient, "$queryRaw" | "emailOutbox">;
type ClaimedEmail = EmailOutbox & { leaseToken: string };
type DeliveryDecision = Exclude<EmailDeliveryResult, { status: "disabled" }>;

// The transport is chosen only by EMAIL_DRIVER. There is no automatic fallback between transports.
export function createEmailProvider(config: EmailDeliveryConfig): TransactionalEmailProvider {
  return config.driver === "zeptomail" ? createZeptoMailEmailProvider(config) : createSmtpEmailProvider(config);
}

// Sanitized operational log: opaque hashes and enums only. Never the recipient, subject/body,
// customer name, order number, token or any provider response text.
export type EmailDeliveryLog = {
  provider: string;
  messageKind: string;
  order: string;
  attempt: number;
  status: string;
  code: string | null;
  providerErrorCode: string | null;
  providerRequestId: string | null;
  latencyMs: number;
};
const defaultLog = (event: EmailDeliveryLog) => console.log(JSON.stringify({ at: new Date().toISOString(), email: event }));
const opaque = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);

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
  log?: (event: EmailDeliveryLog) => void;
}) {
  const env = options.env ?? process.env;
  const summary = { disabled: false, claimed: 0, accepted: 0, retry: 0, failed: 0, uncertain: 0, abandoned: 0 };
  // Validate all environment/SMTP requirements before modifying the queue.
  const config = getEmailDeliveryConfig(env);
  if (!config) return { ...summary, disabled: true };
  const now = options.now ?? (() => new Date());
  const batchSize = options.batchSize ?? 10;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("Invalid email batch size.");
  const provider = options.provider ?? createEmailProvider(config);
  const log = options.log ?? defaultLog;
  summary.abandoned = await options.repository.recoverAbandoned(now());
  for (let index = 0; index < batchSize; index += 1) {
    const row = await options.repository.claim(now(), config.sendNotBefore);
    if (!row) break;
    summary.claimed += 1;
    let decision: DeliveryDecision;
    const startedAt = Date.now();
    try {
      if (!["payment_approved", "order_shipped"].includes(row.kind) || !Number.isInteger(row.totalInCents) || row.totalInCents < 0) {
        throw new EmailDeliveryError("failed", "InvalidEmailSnapshot");
      }
      const render = row.kind === "order_shipped" ? renderOrderShippedEmail : renderPaymentApprovedEmail;
      const message = render({
        to: row.recipient ?? "",
        customerName: row.customerName ?? "Cliente RARE",
        orderNumber: row.orderNumber,
        total: formatMoney(row.totalInCents),
      });
      // Guard original value before template sanitization as well as adapter.
      assertEmailRecipientAllowed({ ...message, to: row.recipient ?? "" }, config);
      const result = await deliverTransactionalEmail(message, row.messageId, provider, env);
      decision = result.status === "disabled"
        ? { status: "failed", provider: config.driver, code: "EmailDisabledDuringAttempt" }
        : result;
    } catch (error) {
      decision = error instanceof EmailDeliveryError
        ? { status: error.outcome, provider: config.driver, code: error.code, ...(error.detail ? { detail: error.detail } : {}) }
        : { status: "uncertain", provider: config.driver, code: "UnclassifiedWorkerFailure" };
    }
    // Persistence errors stop this worker; the sending lease becomes uncertain.
    // Payment was already committed and the message is not sent again blindly.
    const status = await options.repository.finish(row, decision, now());
    summary[status] += 1;
    log({
      provider: config.driver,
      messageKind: row.kind,
      order: opaque(row.orderId),
      attempt: row.attempts,
      status,
      code: decision.status === "accepted" ? null : decision.code,
      providerErrorCode: decision.status !== "accepted" && decision.detail ? decision.detail : null,
      providerRequestId: decision.status === "accepted" && decision.id.startsWith("zeptomail:") ? decision.id.slice("zeptomail:".length) : null,
      latencyMs: Date.now() - startedAt,
    });
  }
  return summary;
}
