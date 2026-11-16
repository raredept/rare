-- RARE-ORDER-ITEM-IMAGE-01: unique SKU per sellable unit (ProductVariant) and a catalog snapshot
-- (SKU + image) on each order item. No order row is backfilled: orders created before this
-- migration keep NULL snapshots and the Admin falls back to the current catalog, labelled as such.

-- 1. Bring existing SKUs to the canonical form the application writes from now on
--    (trimmed, upper case). A blank SKU becomes NULL, never "".
UPDATE "ProductVariant"
SET "sku" = NULLIF(UPPER(BTRIM("sku", E' \t\r\n')), '')
WHERE "sku" IS NOT NULL
  AND "sku" IS DISTINCT FROM NULLIF(UPPER(BTRIM("sku", E' \t\r\n')), '');

-- 2. Uniqueness cannot be created over duplicates. Should two variants share a SKU, the active
--    and oldest one keeps it and the others go back to NULL (the operator can set a new one).
--    Stock, sizes and orders are untouched.
WITH "ranked" AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "sku" ORDER BY "active" DESC, "createdAt" ASC, "id" ASC) AS "position"
  FROM "ProductVariant"
  WHERE "sku" IS NOT NULL
)
UPDATE "ProductVariant" AS "variant"
SET "sku" = NULL
FROM "ranked"
WHERE "variant"."id" = "ranked"."id" AND "ranked"."position" > 1;

-- 3. Database-level guarantee: concurrent saves cannot create a duplicate. PostgreSQL unique
--    indexes treat NULLs as distinct, so any number of variants may have no SKU.
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- 4. Order item snapshot. Nullable and additive.
ALTER TABLE "OrderItem"
  ADD COLUMN "skuSnapshot" TEXT,
  ADD COLUMN "imageUrlSnapshot" TEXT,
  ADD COLUMN "catalogSnapshotAt" TIMESTAMP(3);
