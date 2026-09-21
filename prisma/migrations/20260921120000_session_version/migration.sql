-- Server-side session revocation on logout.
-- ADD COLUMN with a constant default is a catalog-only change on PostgreSQL 11+:
-- no table rewrite, brief ACCESS EXCLUSIVE lock only.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
