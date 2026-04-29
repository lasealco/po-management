-- Sprint 25: Enterprise Knowledge & Document Intelligence
CREATE TABLE "AssistantEnterpriseKnowledgePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "knowledgeScore" INTEGER NOT NULL DEFAULT 0,
    "evidenceCitationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "promptGovernanceRiskCount" INTEGER NOT NULL DEFAULT 0,
    "reviewPipelineGapCount" INTEGER NOT NULL DEFAULT 0,
    "releaseGateRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "citationEvidenceJson" JSONB NOT NULL,
    "promptGovernanceJson" JSONB NOT NULL,
    "reviewPipelineJson" JSONB NOT NULL,
    "releaseGateJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEnterpriseKnowledgePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantEnterpriseKnowledgePacket_tenantId_status_updatedAt_idx" ON "AssistantEnterpriseKnowledgePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantEnterpriseKnowledgePacket_tenantId_knowledgeScore_updatedAt_idx" ON "AssistantEnterpriseKnowledgePacket"("tenantId", "knowledgeScore", "updatedAt");

ALTER TABLE "AssistantEnterpriseKnowledgePacket" ADD CONSTRAINT "AssistantEnterpriseKnowledgePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantEnterpriseKnowledgePacket" ADD CONSTRAINT "AssistantEnterpriseKnowledgePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantEnterpriseKnowledgePacket" ADD CONSTRAINT "AssistantEnterpriseKnowledgePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
