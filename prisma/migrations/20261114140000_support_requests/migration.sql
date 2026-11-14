-- Additive only: durable customer support requests (/suporte). No existing table changes shape;
-- the foreign keys are nullable and SET NULL, so deleting a customer, product or order keeps the
-- request and its snapshots.
CREATE TYPE "SupportCategory" AS ENUM ('PRODUCT_QUESTION', 'SOLD_OUT_PRODUCT', 'ORDER', 'PAYMENT', 'SHIPPING', 'RETURN', 'OTHER');

CREATE TYPE "SupportDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT,
    "productTitleSnapshot" TEXT,
    "productSlugSnapshot" TEXT,
    "orderId" TEXT,
    "orderNumberSnapshot" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "emailSentAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "confirmationStatus" "SupportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationSentAt" TIMESTAMP(3),
    "confirmationErrorCode" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportRequest_protocol_key" ON "SupportRequest"("protocol");

CREATE UNIQUE INDEX "SupportRequest_submissionKey_key" ON "SupportRequest"("submissionKey");

CREATE INDEX "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");

CREATE INDEX "SupportRequest_status_nextAttemptAt_idx" ON "SupportRequest"("status", "nextAttemptAt");

CREATE INDEX "SupportRequest_confirmationStatus_nextAttemptAt_idx" ON "SupportRequest"("confirmationStatus", "nextAttemptAt");

CREATE INDEX "SupportRequest_customerId_createdAt_idx" ON "SupportRequest"("customerId", "createdAt");

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
