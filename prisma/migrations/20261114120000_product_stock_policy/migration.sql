-- Additive only: every existing product keeps the replenishable behaviour (STANDARD) until an
-- operator marks it as a one-of-a-kind piece (UNIQUE) in the product form.
CREATE TYPE "StockPolicy" AS ENUM ('STANDARD', 'UNIQUE');

ALTER TABLE "Product" ADD COLUMN "stockPolicy" "StockPolicy" NOT NULL DEFAULT 'STANDARD';
