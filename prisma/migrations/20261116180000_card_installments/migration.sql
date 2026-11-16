-- RARE-CARD-INSTALLMENTS-01: card installment rules (Admin) and per-order installment snapshot.
-- Additive only: every new column is nullable or has a default, so existing rows stay valid and
-- existing orders (Pix and card 1x) keep exactly the same totals. Installments stay OFF by default.

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "cardInstallmentsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cardInstallmentsMax" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN "cardInstallmentsMinInCents" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "cardInstallment4xBps" INTEGER,
ADD COLUMN "cardInstallment5xBps" INTEGER,
ADD COLUMN "cardInstallment6xBps" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "asaasInstallmentId" TEXT,
ADD COLUMN "paymentInstallmentCount" INTEGER,
ADD COLUMN "paymentInstallmentRateBps" INTEGER,
ADD COLUMN "paymentInstallmentFeeInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentBaseTotalInCents" INTEGER,
ADD COLUMN "paymentInstallmentValueInCents" INTEGER,
ADD COLUMN "paymentLastInstallmentValueInCents" INTEGER;

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN "installmentCount" INTEGER,
ADD COLUMN "installmentValueInCents" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Order_asaasInstallmentId_key" ON "Order"("asaasInstallmentId");
