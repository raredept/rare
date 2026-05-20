-- Add nullable manual ordering for featured products without changing existing catalog order.
ALTER TABLE "Product" ADD COLUMN "featuredSortOrder" INTEGER;

CREATE INDEX "Product_active_featured_featuredSortOrder_idx" ON "Product"("active", "featured", "featuredSortOrder");
