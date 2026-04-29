-- Sprint 19: Strategic Sourcing & Category Intelligence
CREATE TABLE "AssistantStrategicSourcingPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "sourcingScore" INTEGER NOT NULL DEFAULT 0,
    "concentrationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "rfqPipelineRiskCount" INTEGER NOT NULL DEFAULT 0,
    "tariffCoverageRiskCount" INTEGER NOT NULL DEFAULT 0,
    "supplierPanelRiskCount" INTEGER NOT NULL DEFAULT 0,
    "compliancePortfolioRiskCount" INTEGER NOT NULL DEFAULT 0,
    "savingsPipelineRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "spendCategoryJson" JSONB NOT NULL,
    "rfqPipelineJson" JSONB NOT NULL,
    "tariffCoverageJson" JSONB NOT NULL,
    "supplierPanelJson" JSONB NOT NULL,
    "compliancePortfolioJson" JSONB NOT NULL,
    "savingsPipelineJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantStrategicSourcingPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantStrategicSourcingPacket_tenantId_status_updatedAt_idx" ON "AssistantStrategicSourcingPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantStrategicSourcingPacket_tenantId_sourcingScore_updatedAt_idx" ON "AssistantStrategicSourcingPacket"("tenantId", "sourcingScore", "updatedAt");

ALTER TABLE "AssistantStrategicSourcingPacket" ADD CONSTRAINT "AssistantStrategicSourcingPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantStrategicSourcingPacket" ADD CONSTRAINT "AssistantStrategicSourcingPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantStrategicSourcingPacket" ADD CONSTRAINT "AssistantStrategicSourcingPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
