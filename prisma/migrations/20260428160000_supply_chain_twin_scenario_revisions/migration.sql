-- CreateTable
CREATE TABLE "SupplyChainTwinScenarioRevision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scenarioDraftId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "titleBefore" TEXT,
    "titleAfter" TEXT,
    "statusBefore" TEXT,
    "statusAfter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyChainTwinScenarioRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyChainTwinScenarioRevision_tenantId_idx" ON "SupplyChainTwinScenarioRevision"("tenantId");

-- CreateIndex (short explicit name: PG truncates long Prisma default names to 63 bytes and
-- two similar composite index names can collide).
CREATE INDEX "sctwin_scen_rev_draft_created_idx" ON "SupplyChainTwinScenarioRevision"("tenantId", "scenarioDraftId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplyChainTwinScenarioRevision" ADD CONSTRAINT "SupplyChainTwinScenarioRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyChainTwinScenarioRevision" ADD CONSTRAINT "SupplyChainTwinScenarioRevision_scenarioDraftId_fkey" FOREIGN KEY ("scenarioDraftId") REFERENCES "SupplyChainTwinScenarioDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
