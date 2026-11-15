import { randomUUID } from "node:crypto";
import type { AsaasWebhookEvent, Prisma } from "@prisma/client";
import { ASAAS_PAYMENT_ID_PATTERN, AsaasError, getAsaasConfig, getAsaasPayment } from "@/lib/asaas";
import { processAsaasPayment } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";

// Durable inbox for Asaas webhooks: store first (unique event id), answer 200, process after.
// Processing never trusts the body: it re-reads the payment from the API, so duplicates, retries
// and out-of-order deliveries all converge on the same, current state.

const LEASE_MS = 120_000;
export const ASAAS_EVENT_MAX_ATTEMPTS = 12;
const EVENT_ID = /^[A-Za-z0-9_&:.-]{3,200}$/;
const EVENT_NAME = /^[A-Z_]{3,80}$/;

export type ParsedAsaasEvent = { id: string; event: string; paymentId: string | null };

/** Minimal, validated view of the body. Everything else (customer, value, ...) is ignored. */
export function parseAsaasWebhookBody(body: unknown): ParsedAsaasEvent | null {
  const value = body as { id?: unknown; event?: unknown; payment?: { id?: unknown } } | null;
  if (!value || typeof value.id !== "string" || typeof value.event !== "string") return null;
  if (!EVENT_ID.test(value.id) || !EVENT_NAME.test(value.event)) return null;
  const paymentId = typeof value.payment?.id === "string" && ASAAS_PAYMENT_ID_PATTERN.test(value.payment.id) ? value.payment.id : null;
  return { id: value.id, event: value.event, paymentId };
}

/** "stored" for a new event, "duplicate" for a redelivery (no second effect). */
export async function storeAsaasWebhookEvent(event: ParsedAsaasEvent, client: Pick<Prisma.TransactionClient, "asaasWebhookEvent"> = prisma) {
  const relevant = event.event.startsWith("PAYMENT_") && event.paymentId;
  const created = await client.asaasWebhookEvent.createMany({
    data: [{ id: event.id, event: event.event, paymentId: event.paymentId, status: relevant ? "pending" : "ignored", processedAt: relevant ? null : new Date() }],
    skipDuplicates: true,
  });
  return created.count === 1 ? ("stored" as const) : ("duplicate" as const);
}

async function claimNext(now: Date) {
  const token = randomUUID();
  const rows = await prisma.$queryRaw<AsaasWebhookEvent[]>`
    UPDATE "AsaasWebhookEvent" SET "status" = 'processing', "leaseToken" = ${token},
      "leaseExpiresAt" = ${new Date(now.getTime() + LEASE_MS)}, "attempts" = "attempts" + 1
    WHERE "id" = (SELECT "id" FROM "AsaasWebhookEvent"
      WHERE (("status" IN ('pending', 'retry') AND "nextAttemptAt" <= ${now})
        OR ("status" = 'processing' AND "leaseExpiresAt" <= ${now}))
      ORDER BY "receivedAt", "id" LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING *
  `;
  return rows[0] ? { event: rows[0], token } : null;
}

/** Drains pending events (worker loop and right after each webhook response). */
export async function processAsaasWebhookEvents(options: { limit?: number; now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date());
  const results: Array<{ eventId: string; outcome: string }> = [];
  for (let index = 0; index < (options.limit ?? 20); index += 1) {
    const claimed = await claimNext(clock());
    if (!claimed) break;
    const { event, token } = claimed;
    try {
      if (!event.paymentId) throw new AsaasError("rejected", "AsaasEventWithoutPayment");
      const payment = await getAsaasPayment(getAsaasConfig(), event.paymentId);
      const result = await processAsaasPayment(payment);
      await prisma.asaasWebhookEvent.updateMany({
        where: { id: event.id, leaseToken: token },
        data: { status: "processed", processedAt: clock(), leaseToken: null, leaseExpiresAt: null, lastErrorCode: result.status === "payment_mismatch" ? "PAYMENT_MISMATCH" : null },
      });
      results.push({ eventId: event.id, outcome: result.status });
    } catch (error) {
      const code = error instanceof AsaasError ? error.code : "PROCESSING_FAILED";
      // Not ours / not a payment (e.g. the dashboard's test event): nothing to retry.
      const permanent = error instanceof AsaasError && (error.code === "AsaasNotFound" || error.code === "InvalidAsaasPaymentId" || error.code === "AsaasEventWithoutPayment");
      const exhausted = event.attempts >= ASAAS_EVENT_MAX_ATTEMPTS;
      await prisma.asaasWebhookEvent.updateMany({
        where: { id: event.id, leaseToken: token },
        data: {
          status: permanent ? "ignored" : exhausted ? "failed" : "retry",
          nextAttemptAt: new Date(clock().getTime() + Math.min(600_000, 15_000 * 2 ** Math.min(event.attempts - 1, 6))),
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: code.slice(0, 60),
          ...(permanent ? { processedAt: clock() } : {}),
        },
      });
      if (exhausted && !permanent) {
        await prisma.adminNotification.createMany({
          data: [{ type: "payment_webhook_failed", title: "Evento Asaas não processado", body: `Um evento de pagamento falhou ${event.attempts} vezes (${code}). Confira o pedido no painel do Asaas.`, href: "/admin/readiness", dedupeKey: `asaas:event-failed:${event.id}` }],
          skipDuplicates: true,
        });
      }
      results.push({ eventId: event.id, outcome: permanent ? "ignored" : code });
    }
  }
  return results;
}

/** Operational signal for readiness: backlog and failures (sanitized counts only). */
export async function getAsaasWebhookHealth(now = new Date()) {
  const [pending, failed, last] = await Promise.all([
    prisma.asaasWebhookEvent.count({ where: { status: { in: ["pending", "retry", "processing"] }, receivedAt: { lt: new Date(now.getTime() - 10 * 60_000) } } }),
    prisma.asaasWebhookEvent.count({ where: { status: "failed" } }),
    prisma.asaasWebhookEvent.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
  ]);
  return { stalePending: pending, failed, lastReceivedAt: last?.receivedAt ?? null };
}
