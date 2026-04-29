-- AMP34: replayable multi-scenario simulation studio packets.

CREATE TABLE "AssistantSimulationStudioPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "simulationScore" INTEGER NOT NULL DEFAULT 0,
    "scenarioCount" INTEGER NOT NULL DEFAULT 0,
    "assumptionCount" INTEGER NOT NULL DEFAULT 0,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "dataFreshnessRiskCount" INTEGER NOT NULL DEFAULT 0,
    "recommendedScenarioKey" VARCHAR(128),
    "assumptionLedgerJson" JSONB NOT NULL,
    "scenarioRunJson" JSONB NOT NULL,
    "comparisonJson" JSONB NOT NULL,
    "recommendationJson" JSONB NOT NULL,
    "replayPlanJson" JSONB NOT NULL,
    "archivePlanJson" JSONB NOT NULL,
    "approvalPlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSimulationStudioPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantSimulationStudioPacket_tenantId_status_updatedAt_idx" ON "AssistantSimulationStudioPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantSimulationStudioPacket_tenantId_simulationScore_updatedAt_idx" ON "AssistantSimulationStudioPacket"("tenantId", "simulationScore", "updatedAt");
CREATE INDEX "AssistantSimulationStudioPacket_tenantId_recommendedScenarioKey_updatedAt_idx" ON "AssistantSimulationStudioPacket"("tenantId", "recommendedScenarioKey", "updatedAt");

ALTER TABLE "AssistantSimulationStudioPacket" ADD CONSTRAINT "AssistantSimulationStudioPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantSimulationStudioPacket" ADD CONSTRAINT "AssistantSimulationStudioPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantSimulationStudioPacket" ADD CONSTRAINT "AssistantSimulationStudioPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
