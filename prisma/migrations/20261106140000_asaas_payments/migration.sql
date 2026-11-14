-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'asaas';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "asaasCustomerId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "asaasPaymentId" TEXT,
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AsaasWebhookEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsaasWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsaasWebhookEvent_status_nextAttemptAt_idx" ON "AsaasWebhookEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AsaasWebhookEvent_paymentId_idx" ON "AsaasWebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "AsaasWebhookEvent_receivedAt_idx" ON "AsaasWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_asaasCustomerId_key" ON "Customer"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_asaasPaymentId_key" ON "Order"("asaasPaymentId");

