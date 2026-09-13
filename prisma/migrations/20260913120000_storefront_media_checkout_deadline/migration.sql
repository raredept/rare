-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "checkoutDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "checkoutExpiredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "instagramUrl" TEXT NOT NULL DEFAULT 'https://www.instagram.com/rare.deptt/',
ALTER COLUMN "checkoutReservationMinutes" SET DEFAULT 15;

-- AlterTable
ALTER TABLE "HomeBannerSlide" ADD COLUMN     "imageFit" TEXT NOT NULL DEFAULT 'cover',
ADD COLUMN     "imagePositionX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "imagePositionY" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "mobileImagePositionX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "mobileImagePositionY" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "placement" TEXT NOT NULL DEFAULT 'home';

-- CreateTable
CREATE TABLE "CheckoutExpiryJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "providerCheckedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutExpiryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMediaAsset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "framing" JSONB,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutExpiryJob_orderId_key" ON "CheckoutExpiryJob"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutExpiryJob_status_nextAttemptAt_idx" ON "CheckoutExpiryJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "CheckoutExpiryJob_status_leaseExpiresAt_idx" ON "CheckoutExpiryJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMediaAsset_url_key" ON "ProductMediaAsset"("url");

-- CreateIndex
CREATE INDEX "HomeBannerSlide_placement_active_sortOrder_idx" ON "HomeBannerSlide"("placement", "active", "sortOrder");

-- AddForeignKey
ALTER TABLE "CheckoutExpiryJob" ADD CONSTRAINT "CheckoutExpiryJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
