-- Additive only: a new table for consent-based storefront analytics. No personal data columns.
CREATE TABLE "SiteAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "productId" TEXT,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteAnalyticsEvent_createdAt_type_idx" ON "SiteAnalyticsEvent"("createdAt", "type");

CREATE INDEX "SiteAnalyticsEvent_type_productId_createdAt_idx" ON "SiteAnalyticsEvent"("type", "productId", "createdAt");
