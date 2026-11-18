-- Additive only (RARE-FINAL-AUDIT-ASSISTANT-01): storefront virtual assistant. Two new tables, no
-- existing table changes shape and no row is inserted, so the assistant starts DISABLED (a missing
-- config row means the code defaults with enabled = false). Deleting an Admin user keeps the
-- entries (SET NULL on the author columns). Rollback: DROP TABLE "VirtualAssistantEntry";
-- DROP TABLE "VirtualAssistantConfig"; and delete this row from "_prisma_migrations".
CREATE TABLE "VirtualAssistantConfig" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL DEFAULT 'Assistente RARE',
    "welcomeMessage" TEXT NOT NULL,
    "inputPlaceholder" TEXT NOT NULL,
    "fallbackMessage" TEXT NOT NULL,
    "supportCtaLabel" TEXT NOT NULL DEFAULT 'Falar com a equipe',
    "supportCtaHref" TEXT NOT NULL DEFAULT '/suporte',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAssistantConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VirtualAssistantEntry" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAssistantEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VirtualAssistantEntry_active_priority_sortOrder_idx" ON "VirtualAssistantEntry"("active", "priority", "sortOrder");

ALTER TABLE "VirtualAssistantEntry" ADD CONSTRAINT "VirtualAssistantEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VirtualAssistantEntry" ADD CONSTRAINT "VirtualAssistantEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
