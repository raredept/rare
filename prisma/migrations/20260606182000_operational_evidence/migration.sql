-- CreateTable
CREATE TABLE "OperationalEvidence" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "environment" TEXT NOT NULL DEFAULT 'staging',
    "checkedAt" TIMESTAMP(3),
    "checkedByLabel" TEXT,
    "notes" TEXT,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalEvidence_key_environment_key" ON "OperationalEvidence"("key", "environment");

-- CreateIndex
CREATE INDEX "OperationalEvidence_status_environment_idx" ON "OperationalEvidence"("status", "environment");

-- CreateIndex
CREATE INDEX "OperationalEvidence_updatedAt_idx" ON "OperationalEvidence"("updatedAt");
