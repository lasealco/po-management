-- AMP19: finance control packets for leakage, disputes, accrual risk, and accounting handoff review.
CREATE TABLE "AssistantFinancePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "totalVariance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "disputeAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "accrualAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "selectedIntakeId" TEXT,
    "varianceSummaryJson" JSONB NOT NULL,
    "leakageJson" JSONB NOT NULL,
    "disputeQueueJson" JSONB NOT NULL,
    "accrualRiskJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "boardSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantFinancePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantFinancePacket_tenantId_status_updatedAt_idx" ON "AssistantFinancePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantFinancePacket_tenantId_selectedIntakeId_idx" ON "AssistantFinancePacket"("tenantId", "selectedIntakeId");

ALTER TABLE "AssistantFinancePacket"
    ADD CONSTRAINT "AssistantFinancePacket_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantFinancePacket"
    ADD CONSTRAINT "AssistantFinancePacket_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantFinancePacket"
    ADD CONSTRAINT "AssistantFinancePacket_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
