-- Additive only. Deploy before code that atomically enqueues paid-order emails.
CREATE TYPE "EmailOutboxStatus" AS ENUM ('pending', 'sending', 'retry', 'accepted', 'failed', 'uncertain');

CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'payment_approved',
    "recipient" TEXT,
    "customerName" TEXT,
    "orderNumber" TEXT NOT NULL,
    "totalInCents" INTEGER NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "provider" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmailOutbox_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailOutbox_messageId_key" ON "EmailOutbox"("messageId");
CREATE UNIQUE INDEX "EmailOutbox_orderId_kind_key" ON "EmailOutbox"("orderId", "kind");
CREATE INDEX "EmailOutbox_status_nextAttemptAt_createdAt_idx" ON "EmailOutbox"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "EmailOutbox_status_leaseExpiresAt_idx" ON "EmailOutbox"("status", "leaseExpiresAt");
