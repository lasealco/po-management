-- Sprint 12: durable Finance, Cash & Accounting Controls packets.
CREATE TABLE "AssistantFinanceCashControlPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "financeScore" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "cashExposureAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "receivableRiskAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "payableRiskAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "marginLeakageAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "accountingBlockerCount" INTEGER NOT NULL DEFAULT 0,
    "billingExceptionCount" INTEGER NOT NULL DEFAULT 0,
    "closeControlGapCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "cashPostureJson" JSONB NOT NULL,
    "receivablesJson" JSONB NOT NULL,
    "payablesJson" JSONB NOT NULL,
    "accountingHandoffJson" JSONB NOT NULL,
    "marginLeakageJson" JSONB NOT NULL,
    "warehouseBillingJson" JSONB NOT NULL,
    "closeControlJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantFinanceCashControlPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantFinanceCashControlPacket_tenantId_status_updatedAt_idx" ON "AssistantFinanceCashControlPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantFinanceCashControlPacket_tenantId_financeScore_updatedAt_idx" ON "AssistantFinanceCashControlPacket"("tenantId", "financeScore", "updatedAt");

ALTER TABLE "AssistantFinanceCashControlPacket" ADD CONSTRAINT "AssistantFinanceCashControlPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantFinanceCashControlPacket" ADD CONSTRAINT "AssistantFinanceCashControlPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantFinanceCashControlPacket" ADD CONSTRAINT "AssistantFinanceCashControlPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
