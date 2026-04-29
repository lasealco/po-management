-- Sprint 15: Autonomous Enterprise OS v2
CREATE TABLE "AssistantEnterpriseOsPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "enterpriseScore" INTEGER NOT NULL DEFAULT 0,
    "autonomyMode" VARCHAR(32) NOT NULL DEFAULT 'REVIEW_ONLY',
    "operatingSignalCount" INTEGER NOT NULL DEFAULT 0,
    "domainControlCount" INTEGER NOT NULL DEFAULT 0,
    "governanceRiskCount" INTEGER NOT NULL DEFAULT 0,
    "valueRiskCount" INTEGER NOT NULL DEFAULT 0,
    "rolloutRiskCount" INTEGER NOT NULL DEFAULT 0,
    "executionActionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "enterpriseTelemetryJson" JSONB NOT NULL,
    "autonomyReadinessJson" JSONB NOT NULL,
    "governanceReliabilityJson" JSONB NOT NULL,
    "valueExecutionJson" JSONB NOT NULL,
    "domainOrchestrationJson" JSONB NOT NULL,
    "commandCouncilJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEnterpriseOsPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantEnterpriseOsPacket_tenantId_status_updatedAt_idx" ON "AssistantEnterpriseOsPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantEnterpriseOsPacket_tenantId_enterpriseScore_updatedAt_idx" ON "AssistantEnterpriseOsPacket"("tenantId", "enterpriseScore", "updatedAt");
CREATE INDEX "AssistantEnterpriseOsPacket_tenantId_autonomyMode_updatedAt_idx" ON "AssistantEnterpriseOsPacket"("tenantId", "autonomyMode", "updatedAt");

ALTER TABLE "AssistantEnterpriseOsPacket" ADD CONSTRAINT "AssistantEnterpriseOsPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantEnterpriseOsPacket" ADD CONSTRAINT "AssistantEnterpriseOsPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantEnterpriseOsPacket" ADD CONSTRAINT "AssistantEnterpriseOsPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
