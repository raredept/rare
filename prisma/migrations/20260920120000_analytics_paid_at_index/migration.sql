-- Admin analytics filters paid orders by the moment they were paid.
-- Without this index every revenue query is a sequential scan of "Order".
CREATE INDEX IF NOT EXISTS "Order_status_paidAt_idx" ON "Order" ("status", "paidAt");

-- Top products/variants join OrderItem back to Order for the same window.
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_productId_idx" ON "OrderItem" ("orderId", "productId");
