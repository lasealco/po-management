-- AMP35: continuous planning control tower packets.

CREATE TABLE "AssistantContinuousPlanningPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "planHealthScore" INTEGER NOT NULL DEFAULT 0,
    "replanningTriggerCount" INTEGER NOT NULL DEFAULT 0,
    "demandVariancePct" INTEGER NOT NULL DEFAULT 0,
    "supplyCoveragePct" INTEGER NOT NULL DEFAULT 0,
    "inventoryCoveragePct" INTEGER NOT NULL DEFAULT 0,
    "transportRiskCount" INTEGER NOT NULL DEFAULT 0,
    "recoveryActionCount" INTEGER NOT NULL DEFAULT 0,
    "controlSnapshotJson" JSONB NOT NULL,
    "varianceJson" JSONB NOT NULL,
    "triggerJson" JSONB NOT NULL,
    "recoveryPlanJson" JSONB NOT NULL,
    "ownerWorkJson" JSONB NOT NULL,
    "approvalPlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantContinuousPlanningPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantContinuousPlanningPacket_tenantId_status_updatedAt_idx" ON "AssistantContinuousPlanningPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantContinuousPlanningPacket_tenantId_planHealthScore_updatedAt_idx" ON "AssistantContinuousPlanningPacket"("tenantId", "planHealthScore", "updatedAt");
CREATE INDEX "AssistantContinuousPlanningPacket_tenantId_replanningTriggerCount_updatedAt_idx" ON "AssistantContinuousPlanningPacket"("tenantId", "replanningTriggerCount", "updatedAt");

ALTER TABLE "AssistantContinuousPlanningPacket" ADD CONSTRAINT "AssistantContinuousPlanningPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantContinuousPlanningPacket" ADD CONSTRAINT "AssistantContinuousPlanningPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantContinuousPlanningPacket" ADD CONSTRAINT "AssistantContinuousPlanningPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
