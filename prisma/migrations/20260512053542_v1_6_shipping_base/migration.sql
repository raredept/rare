-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCepSnapshot" TEXT,
ADD COLUMN     "shippingMethodSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" INTEGER;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "checkoutRequiresAddress" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fixedShippingInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freeShippingThresholdInCents" INTEGER,
ADD COLUMN     "originCep" TEXT,
ADD COLUMN     "shippingInstructions" TEXT,
ADD COLUMN     "shippingMode" TEXT NOT NULL DEFAULT 'fixed';
