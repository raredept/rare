-- Pix through the Mercado Pago Checkout API. Additive only: a new enum value, one nullable
-- column and one new table. Existing orders keep paymentProvider = 'stripe'.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'mercadopago';

ALTER TABLE "Order" ADD COLUMN "mercadoPagoPaymentId" TEXT;
CREATE UNIQUE INDEX "Order_mercadoPagoPaymentId_key" ON "Order"("mercadoPagoPaymentId");

CREATE TABLE "PixCharge" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "copyPaste" TEXT NOT NULL,
    "qrCodeBase64" TEXT,
    "ticketUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PixCharge_orderId_key" ON "PixCharge"("orderId");

ALTER TABLE "PixCharge" ADD CONSTRAINT "PixCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
