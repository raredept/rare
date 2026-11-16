-- RARE-CARD-INSTALLMENTS-01: card installment rules (Admin) and per-order installment snapshot.
-- Additive only: every new column is nullable or has a default, so existing rows stay valid and
-- existing orders (Pix and card 1x) keep exactly the same totals. Installments stay OFF
-- (cardInstallmentsEnabled=false, plus the CARD_INSTALLMENTS_ENABLED deploy flag). The surcharge
-- table default is the commercial table approved by the owner on 2026-11-16 (1x-3x 0%, 4x 9% ... 12x 18%).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "asaasInstallmentId" TEXT,
ADD COLUMN     "paymentBaseTotalInCents" INTEGER,
ADD COLUMN     "paymentInstallmentCount" INTEGER,
ADD COLUMN     "paymentInstallmentFeeInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentInstallmentRateBps" INTEGER,
ADD COLUMN     "paymentInstallmentValueInCents" INTEGER,
ADD COLUMN     "paymentLastInstallmentValueInCents" INTEGER;

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "installmentCount" INTEGER,
ADD COLUMN     "installmentValueInCents" INTEGER;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "cardInstallmentSurchargesBps" JSONB NOT NULL DEFAULT '{"4":900,"5":1000,"6":1100,"7":1300,"8":1400,"9":1500,"10":1600,"11":1700,"12":1800}',
ADD COLUMN     "cardInstallmentsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardInstallmentsMax" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "cardInstallmentsMinInCents" INTEGER NOT NULL DEFAULT 1000;

-- CreateIndex
CREATE UNIQUE INDEX "Order_asaasInstallmentId_key" ON "Order"("asaasInstallmentId");

