-- AMP36: quote-to-contract revenue operations packets.

CREATE TABLE "AssistantRevenueOperationsPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "revenueScore" INTEGER NOT NULL DEFAULT 0,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "opportunityCount" INTEGER NOT NULL DEFAULT 0,
    "feasibilityRiskCount" INTEGER NOT NULL DEFAULT 0,
    "pricingRiskCount" INTEGER NOT NULL DEFAULT 0,
    "approvalStepCount" INTEGER NOT NULL DEFAULT 0,
    "selectedQuoteId" TEXT,
    "commercialSnapshotJson" JSONB NOT NULL,
    "feasibilityJson" JSONB NOT NULL,
    "pricingEvidenceJson" JSONB NOT NULL,
    "approvalRouteJson" JSONB NOT NULL,
    "customerDraftJson" JSONB NOT NULL,
    "contractHandoffJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantRevenueOperationsPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantRevenueOperationsPacket_tenantId_status_updatedAt_idx" ON "AssistantRevenueOperationsPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantRevenueOperationsPacket_tenantId_revenueScore_updatedAt_idx" ON "AssistantRevenueOperationsPacket"("tenantId", "revenueScore", "updatedAt");
CREATE INDEX "AssistantRevenueOperationsPacket_tenantId_selectedQuoteId_idx" ON "AssistantRevenueOperationsPacket"("tenantId", "selectedQuoteId");

ALTER TABLE "AssistantRevenueOperationsPacket" ADD CONSTRAINT "AssistantRevenueOperationsPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantRevenueOperationsPacket" ADD CONSTRAINT "AssistantRevenueOperationsPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantRevenueOperationsPacket" ADD CONSTRAINT "AssistantRevenueOperationsPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
