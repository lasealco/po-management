-- AMP23: Contract lifecycle and compliance assistant persistence.

CREATE TABLE "AssistantContractCompliancePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "complianceScore" INTEGER NOT NULL DEFAULT 0,
    "obligationCount" INTEGER NOT NULL DEFAULT 0,
    "expiringDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "renewalRiskCount" INTEGER NOT NULL DEFAULT 0,
    "complianceGapCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "obligationJson" JSONB NOT NULL,
    "renewalRiskJson" JSONB NOT NULL,
    "documentRiskJson" JSONB NOT NULL,
    "complianceGapJson" JSONB NOT NULL,
    "actionPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantContractCompliancePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantContractCompliancePacket_tenantId_status_updatedAt_idx" ON "AssistantContractCompliancePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantContractCompliancePacket_tenantId_complianceScore_updatedAt_idx" ON "AssistantContractCompliancePacket"("tenantId", "complianceScore", "updatedAt");

ALTER TABLE "AssistantContractCompliancePacket" ADD CONSTRAINT "AssistantContractCompliancePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantContractCompliancePacket" ADD CONSTRAINT "AssistantContractCompliancePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantContractCompliancePacket" ADD CONSTRAINT "AssistantContractCompliancePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
