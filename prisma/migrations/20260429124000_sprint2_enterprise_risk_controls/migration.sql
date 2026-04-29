-- Sprint 2: durable Enterprise Risk & Controls packets.
CREATE TABLE "AssistantEnterpriseRiskControlPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "obligationCount" INTEGER NOT NULL DEFAULT 0,
    "controlGapCount" INTEGER NOT NULL DEFAULT 0,
    "auditEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "contractRiskCount" INTEGER NOT NULL DEFAULT 0,
    "externalRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "obligationGraphJson" JSONB NOT NULL,
    "controlTestingJson" JSONB NOT NULL,
    "auditEvidenceJson" JSONB NOT NULL,
    "contractPerformanceJson" JSONB NOT NULL,
    "regulatoryHorizonJson" JSONB NOT NULL,
    "externalRiskJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEnterpriseRiskControlPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantEnterpriseRiskControlPacket_tenantId_status_updatedAt_idx" ON "AssistantEnterpriseRiskControlPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantEnterpriseRiskControlPacket_tenantId_riskScore_updatedAt_idx" ON "AssistantEnterpriseRiskControlPacket"("tenantId", "riskScore", "updatedAt");

ALTER TABLE "AssistantEnterpriseRiskControlPacket" ADD CONSTRAINT "AssistantEnterpriseRiskControlPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantEnterpriseRiskControlPacket" ADD CONSTRAINT "AssistantEnterpriseRiskControlPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantEnterpriseRiskControlPacket" ADD CONSTRAINT "AssistantEnterpriseRiskControlPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
