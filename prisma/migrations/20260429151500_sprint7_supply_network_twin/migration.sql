-- Sprint 7: durable Supply Network Twin & Scenario Command packets.
CREATE TABLE "AssistantSupplyNetworkTwinPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "twinScore" INTEGER NOT NULL DEFAULT 0,
    "graphNodeCount" INTEGER NOT NULL DEFAULT 0,
    "graphEdgeCount" INTEGER NOT NULL DEFAULT 0,
    "scenarioCount" INTEGER NOT NULL DEFAULT 0,
    "bottleneckCount" INTEGER NOT NULL DEFAULT 0,
    "disruptionRiskCount" INTEGER NOT NULL DEFAULT 0,
    "recoveryActionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "graphCoverageJson" JSONB NOT NULL,
    "networkBaselineJson" JSONB NOT NULL,
    "scenarioCommandJson" JSONB NOT NULL,
    "bottleneckJson" JSONB NOT NULL,
    "disruptionJson" JSONB NOT NULL,
    "recoveryPlaybookJson" JSONB NOT NULL,
    "confidenceJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSupplyNetworkTwinPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantSupplyNetworkTwinPacket_tenantId_status_updatedAt_idx" ON "AssistantSupplyNetworkTwinPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantSupplyNetworkTwinPacket_tenantId_twinScore_updatedAt_idx" ON "AssistantSupplyNetworkTwinPacket"("tenantId", "twinScore", "updatedAt");

ALTER TABLE "AssistantSupplyNetworkTwinPacket" ADD CONSTRAINT "AssistantSupplyNetworkTwinPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantSupplyNetworkTwinPacket" ADD CONSTRAINT "AssistantSupplyNetworkTwinPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantSupplyNetworkTwinPacket" ADD CONSTRAINT "AssistantSupplyNetworkTwinPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
