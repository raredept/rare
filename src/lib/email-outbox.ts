import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

type PaidOrderEmailSnapshot = {
  id: string;
  orderNumber: string;
  customerEmailSnapshot: string | null;
  customerNameSnapshot: string | null;
  totalInCents: number;
};

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
      messageId: `<rare-${key}@raredept.com.br>`,
    }],
    skipDuplicates: true,
  });
}
