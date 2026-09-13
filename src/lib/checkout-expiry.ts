import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { CheckoutExpiryJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { processStripeCheckoutEvent, processStripePaymentIntentEvent } from "@/lib/checkout";
import { releasableReservationStatuses } from "@/lib/order-status";

const LEASE_MS = 120_000;
type ReconcileResult = { outcome: "released" | "paid" | "processing" | "terminal"; checkedAt?: Date };

/** Find an accepted session after a lost creation response/database failure.
 * Absence in this bounded scan is ambiguous, never permission to free stock. */
async function recoverSession(order: { id: string; createdAt: Date }) {
  const stripe = getStripe();
  let cursor: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const sessions = await stripe.checkout.sessions.list({
      created: { gte: Math.floor(order.createdAt.getTime() / 1000) - 60 },
      limit: 100, ...(cursor ? { starting_after: cursor } : {}),
    });
    const match = sessions.data.find((session) => session.client_reference_id === order.id && session.metadata?.orderId === order.id);
    if (match) {
      await prisma.order.updateMany({ where: { id: order.id, stripeCheckoutSessionId: null }, data: { stripeCheckoutSessionId: match.id } });
      return match.id;
    }
    if (!sessions.has_more) break;
    cursor = sessions.data.at(-1)?.id;
  }
  throw new Error("SESSION_CREATION_UNCONFIRMED");
}

export async function reconcileCheckoutExpiry(orderId: string): Promise<ReconcileResult> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!releasableReservationStatuses.includes(order.status)) return { outcome: "terminal" };
  const stripe = getStripe();
  const sessionId = order.stripeCheckoutSessionId ?? await recoverSession(order);
  let session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  if (session.metadata?.orderId !== order.id || session.client_reference_id !== order.id) throw new Error("SESSION_ORDER_MISMATCH");

  const reconcilePayment = async (current: Stripe.Checkout.Session): Promise<ReconcileResult | null> => {
    if (current.payment_status === "paid") {
      await processStripeCheckoutEvent(`reconcile:${current.id}:paid`, "checkout.session.completed", current);
      return { outcome: "paid", checkedAt: new Date() };
    }
    const intent = typeof current.payment_intent === "string"
      ? await stripe.paymentIntents.retrieve(current.payment_intent) : current.payment_intent;
    if (intent?.status === "succeeded") {
      await processStripePaymentIntentEvent(`reconcile:${intent.id}:succeeded`, "payment_intent.succeeded", intent);
      return { outcome: "paid", checkedAt: new Date() };
    }
    if (intent?.status === "processing" || intent?.status === "requires_capture") {
      // Also persist what polling learned before the webhook arrives. The
      // immutable commercial deadline remains available for history/countdown.
      await prisma.order.updateMany({ where: { id: order.id, status: { in: releasableReservationStatuses } }, data: { reservationExpiresAt: null } });
      return { outcome: "processing", checkedAt: new Date() };
    }
    if (current.status === "complete") {
      // Completed unpaid can settle asynchronously, even before its intent
      // becomes observable. Retry until a signed terminal event or paid state.
      await processStripeCheckoutEvent(`reconcile:${current.id}:complete`, "checkout.session.completed", current);
      return { outcome: "processing", checkedAt: new Date() };
    }
    return null;
  };

  const payment = await reconcilePayment(session);
  if (payment) return payment;
  if (session.status === "open") {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Timeout / already completed / already expired: retrieve authoritative
      // state again. A second error bubbles into a durable retry with stock held.
    }
    session = await stripe.checkout.sessions.retrieve(session.id, { expand: ["payment_intent"] });
    const racedPayment = await reconcilePayment(session);
    if (racedPayment) return racedPayment;
  }
  if (session.status !== "expired") throw new Error("PROVIDER_NOT_EXPIRED");
  const result = await processStripeCheckoutEvent(`reconcile:${session.id}:expired`, "checkout.session.expired", session);
  return { outcome: result.status === "released" ? "released" : "terminal", checkedAt: new Date() };
}

export async function runCheckoutExpiryBatch(options: { now?: Date; limit?: number } = {}) {
  // Backfill older orders using their EXISTING deadlines, never shorten them.
  const now = options.now ?? new Date();
  await prisma.$executeRaw`
    INSERT INTO "CheckoutExpiryJob" ("id", "orderId", "deadlineAt", "nextAttemptAt", "updatedAt")
    SELECT 'legacy_' || md5(o."id"), o."id", o."reservationExpiresAt", o."reservationExpiresAt", NOW()
    FROM "Order" o WHERE o."status" = 'awaiting_payment' AND o."reservationExpiresAt" <= ${now}
    ON CONFLICT ("orderId") DO NOTHING
  `;
  const results: { orderId: string; outcome: string; latencyMs?: number }[] = [];
  for (let i = 0; i < (options.limit ?? 20); i += 1) {
    const claimAt = options.now ?? new Date();
    const token = randomUUID();
    const jobs = await prisma.$queryRaw<CheckoutExpiryJob[]>`
      UPDATE "CheckoutExpiryJob" SET "status" = 'processing', "leaseToken" = ${token},
        "leaseExpiresAt" = ${new Date(claimAt.getTime() + LEASE_MS)}, "attempts" = "attempts" + 1, "updatedAt" = NOW()
      WHERE "id" = (SELECT "id" FROM "CheckoutExpiryJob"
        WHERE (("status" IN ('pending', 'retry') AND "nextAttemptAt" <= ${claimAt})
          OR ("status" = 'processing' AND "leaseExpiresAt" <= ${claimAt}))
        ORDER BY "nextAttemptAt", "id" LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING *
    `;
    const job = jobs[0];
    if (!job) break;
    try {
      const result = await reconcileCheckoutExpiry(job.orderId);
      const finishedAt = options.now ?? new Date();
      const processing = result.outcome === "processing";
      await prisma.checkoutExpiryJob.updateMany({ where: { id: job.id, leaseToken: token }, data: {
        status: processing ? "retry" : "completed", nextAttemptAt: new Date(finishedAt.getTime() + 60_000),
        leaseToken: null, leaseExpiresAt: null, providerCheckedAt: result.checkedAt,
        completedAt: processing ? null : finishedAt, lastErrorCode: processing ? "PAYMENT_PROCESSING" : null,
      } });
      results.push({ orderId: job.orderId, outcome: result.outcome,
        ...(result.outcome === "released" ? { latencyMs: finishedAt.getTime() - job.deadlineAt.getTime() } : {}) });
    } catch (error) {
      // Persist only bounded error codes: provider errors may contain PII/keys.
      const known = ["SESSION_CREATION_UNCONFIRMED", "SESSION_ORDER_MISMATCH", "PROVIDER_NOT_EXPIRED"];
      const errorCode = error instanceof Error && known.includes(error.message) ? error.message : "PROVIDER_RECONCILIATION_FAILED";
      await prisma.checkoutExpiryJob.updateMany({ where: { id: job.id, leaseToken: token }, data: {
        status: "retry", nextAttemptAt: new Date((options.now ?? new Date()).getTime() + Math.min(300_000, 15_000 * 2 ** Math.min(job.attempts - 1, 5))),
        leaseToken: null, leaseExpiresAt: null, lastErrorCode: errorCode,
      } });
      results.push({ orderId: job.orderId, outcome: errorCode });
    }
  }
  return { released: results.filter((result) => result.outcome === "released").length, results };
}
