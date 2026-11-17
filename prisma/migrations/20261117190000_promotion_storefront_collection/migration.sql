-- RARE-COLLECTIONS-CART-01: a promotion can also be shown as a public storefront collection
-- (/colecao/<slug> and the store menu) without touching any product's category.
-- Additive only: three new columns with safe defaults. Every existing promotion stays OFF
-- (storefrontCollectionEnabled=false); nothing is backfilled. Rollback = turn the flag off.

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "storefrontCollectionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storefrontCollectionLabel" TEXT,
ADD COLUMN     "storefrontCollectionSortOrder" INTEGER NOT NULL DEFAULT 0;
