import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

type PaidOrderEmailSnapshot = {
  id: string;
  orderNumber: string;
  customerEmailSnapshot: string | null;
  customerNameSnapshot: string | null;
  totalInCents: number;
  /** Card installments (2x+) shown in the e-mail; absent/null for Pix and 1x. */
  installmentCount?: number | null;
  installmentValueInCents?: number | null;
};

function installmentSnapshot(order: PaidOrderEmailSnapshot) {
  const count = order.installmentCount;
  const value = order.installmentValueInCents;
  return Number.isSafeInteger(count) && (count as number) >= 2 && Number.isSafeInteger(value) && (value as number) > 0
    ? { installmentCount: count as number, installmentValueInCents: value as number }
    : {};
}

// No SMTP, env-dependent branching, or rendering in the payment transaction.
// Missing/invalid recipients are retained for review without blocking payment.
export async function enqueuePaidOrderEmail(
  tx: Pick<Prisma.TransactionClient, "emailOutbox">,
  order: PaidOrderEmailSnapshot,
) {
  const kind = "payment_approved";
  const key = createHash("sha256").update(`${order.id}:${kind}`).digest("hex");
  return tx.emailOutbox.createMany({
    data: [{
      orderId: order.id,
      kind,
      recipient: order.customerEmailSnapshot,
      customerName: order.customerNameSnapshot,
      orderNumber: order.orderNumber,
      totalInCents: order.totalInCents,
      ...installmentSnapshot(order),
      messageId: `<rare-${key}@raredept.com.br>`,
    }],
    skipDuplicates: true,
  });
}

// One "order shipped" message per order (unique orderId+kind). Enqueued in the same
// transaction as the status change; delivery happens later in the outbox worker.
export async function enqueueOrderShippedEmail(
  tx: Pick<Prisma.TransactionClient, "emailOutbox">,
  order: PaidOrderEmailSnapshot,
) {
  const kind = "order_shipped";
  const key = createHash("sha256").update(`${order.id}:${kind}`).digest("hex");
  return tx.emailOutbox.createMany({
    data: [{
      orderId: order.id,
      kind,
      recipient: order.customerEmailSnapshot,
      customerName: order.customerNameSnapshot,
      orderNumber: order.orderNumber,
      totalInCents: order.totalInCents,
      messageId: `<rare-${key}@raredept.com.br>`,
    }],
    skipDuplicates: true,
  });
}
