-- Sprint 4: durable Executive Operating System packets.
CREATE TABLE "AssistantExecutiveOperatingPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "executiveScore" INTEGER NOT NULL DEFAULT 0,
    "boardMetricCount" INTEGER NOT NULL DEFAULT 0,
    "investorNarrativeRiskCount" INTEGER NOT NULL DEFAULT 0,
    "corpDevSignalCount" INTEGER NOT NULL DEFAULT 0,
    "strategyRiskCount" INTEGER NOT NULL DEFAULT 0,
    "decisionCount" INTEGER NOT NULL DEFAULT 0,
    "learningSignalCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "boardBriefJson" JSONB NOT NULL,
    "investorNarrativeJson" JSONB NOT NULL,
    "corpDevRadarJson" JSONB NOT NULL,
    "executiveTwinJson" JSONB NOT NULL,
    "strategyExecutionJson" JSONB NOT NULL,
    "decisionLedgerJson" JSONB NOT NULL,
    "learningLoopJson" JSONB NOT NULL,
    "operatingCadenceJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantExecutiveOperatingPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantExecutiveOperatingPacket_tenantId_status_updatedAt_idx" ON "AssistantExecutiveOperatingPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantExecutiveOperatingPacket_tenantId_executiveScore_updatedAt_idx" ON "AssistantExecutiveOperatingPacket"("tenantId", "executiveScore", "updatedAt");

ALTER TABLE "AssistantExecutiveOperatingPacket" ADD CONSTRAINT "AssistantExecutiveOperatingPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantExecutiveOperatingPacket" ADD CONSTRAINT "AssistantExecutiveOperatingPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantExecutiveOperatingPacket" ADD CONSTRAINT "AssistantExecutiveOperatingPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
