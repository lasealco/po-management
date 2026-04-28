-- AMP29: Enterprise data governance and retention assistant persistence.

CREATE TABLE "AssistantGovernancePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "governanceScore" INTEGER NOT NULL DEFAULT 0,
    "retentionCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "exportRecordCount" INTEGER NOT NULL DEFAULT 0,
    "deletionRequestCount" INTEGER NOT NULL DEFAULT 0,
    "legalHoldBlockCount" INTEGER NOT NULL DEFAULT 0,
    "privacyRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "retentionPlanJson" JSONB NOT NULL,
    "exportManifestJson" JSONB NOT NULL,
    "deletionRequestJson" JSONB NOT NULL,
    "legalHoldJson" JSONB NOT NULL,
    "privacyReviewJson" JSONB NOT NULL,
    "auditPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantGovernancePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantGovernancePacket_tenantId_status_updatedAt_idx" ON "AssistantGovernancePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantGovernancePacket_tenantId_governanceScore_updatedAt_idx" ON "AssistantGovernancePacket"("tenantId", "governanceScore", "updatedAt");

ALTER TABLE "AssistantGovernancePacket" ADD CONSTRAINT "AssistantGovernancePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantGovernancePacket" ADD CONSTRAINT "AssistantGovernancePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantGovernancePacket" ADD CONSTRAINT "AssistantGovernancePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
