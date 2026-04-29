-- Sprint 21: Master Data Governance & Enrichment
CREATE TABLE "AssistantMasterDataGovernancePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "governanceScore" INTEGER NOT NULL DEFAULT 0,
    "duplicateClusterRiskCount" INTEGER NOT NULL DEFAULT 0,
    "staleRecordRiskCount" INTEGER NOT NULL DEFAULT 0,
    "stagingConflictRiskCount" INTEGER NOT NULL DEFAULT 0,
    "hubReviewRiskCount" INTEGER NOT NULL DEFAULT 0,
    "canonicalConflictRiskCount" INTEGER NOT NULL DEFAULT 0,
    "enrichmentQueueRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "duplicateClustersJson" JSONB NOT NULL,
    "staleRecordsJson" JSONB NOT NULL,
    "stagingConflictsJson" JSONB NOT NULL,
    "hubReviewQueueJson" JSONB NOT NULL,
    "canonicalConflictJson" JSONB NOT NULL,
    "enrichmentQueueJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantMasterDataGovernancePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantMasterDataGovernancePacket_tenantId_status_updatedAt_idx" ON "AssistantMasterDataGovernancePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantMasterDataGovernancePacket_tenantId_governanceScore_updatedAt_idx" ON "AssistantMasterDataGovernancePacket"("tenantId", "governanceScore", "updatedAt");

ALTER TABLE "AssistantMasterDataGovernancePacket" ADD CONSTRAINT "AssistantMasterDataGovernancePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantMasterDataGovernancePacket" ADD CONSTRAINT "AssistantMasterDataGovernancePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantMasterDataGovernancePacket" ADD CONSTRAINT "AssistantMasterDataGovernancePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
