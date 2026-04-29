-- Sprint 18: Customer Success & Account Intelligence
CREATE TABLE "AssistantCustomerSuccessPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "accountScore" INTEGER NOT NULL DEFAULT 0,
    "briefRiskCount" INTEGER NOT NULL DEFAULT 0,
    "promiseRiskCount" INTEGER NOT NULL DEFAULT 0,
    "pipelineRiskCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionExposureCount" INTEGER NOT NULL DEFAULT 0,
    "disputeFinanceRiskCount" INTEGER NOT NULL DEFAULT 0,
    "governanceGapCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "briefSignalsJson" JSONB NOT NULL,
    "promiseExecutionJson" JSONB NOT NULL,
    "crmPipelineJson" JSONB NOT NULL,
    "exceptionExposureJson" JSONB NOT NULL,
    "disputeFinanceJson" JSONB NOT NULL,
    "replyGovernanceJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantCustomerSuccessPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantCustomerSuccessPacket_tenantId_status_updatedAt_idx" ON "AssistantCustomerSuccessPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantCustomerSuccessPacket_tenantId_accountScore_updatedAt_idx" ON "AssistantCustomerSuccessPacket"("tenantId", "accountScore", "updatedAt");

ALTER TABLE "AssistantCustomerSuccessPacket" ADD CONSTRAINT "AssistantCustomerSuccessPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantCustomerSuccessPacket" ADD CONSTRAINT "AssistantCustomerSuccessPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantCustomerSuccessPacket" ADD CONSTRAINT "AssistantCustomerSuccessPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
