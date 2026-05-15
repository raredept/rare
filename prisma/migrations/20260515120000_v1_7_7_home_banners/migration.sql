-- CreateTable
CREATE TABLE "HomeBannerSlide" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT,
    "description" TEXT,
    "ctaLabel" TEXT,
    "href" TEXT,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "mobileImageUrl" TEXT,
    "alt" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBannerSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeBannerSlide_active_sortOrder_idx" ON "HomeBannerSlide"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "HomeBannerSlide_sortOrder_idx" ON "HomeBannerSlide"("sortOrder");
