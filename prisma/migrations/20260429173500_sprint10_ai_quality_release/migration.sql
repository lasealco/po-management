-- Sprint 10: durable AI Quality, Evaluation & Release Governance packets.
CREATE TABLE "AssistantAiQualityReleasePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "auditEventCount" INTEGER NOT NULL DEFAULT 0,
    "evalCaseCount" INTEGER NOT NULL DEFAULT 0,
    "failedEvalCount" INTEGER NOT NULL DEFAULT 0,
    "promptRiskCount" INTEGER NOT NULL DEFAULT 0,
    "automationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "observabilityRiskCount" INTEGER NOT NULL DEFAULT 0,
    "releaseBlockerCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "evaluationSuiteJson" JSONB NOT NULL,
    "groundingQualityJson" JSONB NOT NULL,
    "promptModelChangeJson" JSONB NOT NULL,
    "automationRegressionJson" JSONB NOT NULL,
    "observabilityWatchJson" JSONB NOT NULL,
    "releaseGateJson" JSONB NOT NULL,
    "rollbackDrillJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantAiQualityReleasePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantAiQualityReleasePacket_tenantId_status_updatedAt_idx" ON "AssistantAiQualityReleasePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantAiQualityReleasePacket_tenantId_qualityScore_updatedAt_idx" ON "AssistantAiQualityReleasePacket"("tenantId", "qualityScore", "updatedAt");

ALTER TABLE "AssistantAiQualityReleasePacket" ADD CONSTRAINT "AssistantAiQualityReleasePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantAiQualityReleasePacket" ADD CONSTRAINT "AssistantAiQualityReleasePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantAiQualityReleasePacket" ADD CONSTRAINT "AssistantAiQualityReleasePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
