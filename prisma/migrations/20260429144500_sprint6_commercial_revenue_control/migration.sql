-- Sprint 6: durable Commercial & Revenue Control packets.
CREATE TABLE "AssistantCommercialRevenueControlPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "commercialScore" INTEGER NOT NULL DEFAULT 0,
    "quoteRiskCount" INTEGER NOT NULL DEFAULT 0,
    "pricingRiskCount" INTEGER NOT NULL DEFAULT 0,
    "invoiceRiskCount" INTEGER NOT NULL DEFAULT 0,
    "marginLeakageCount" INTEGER NOT NULL DEFAULT 0,
    "contractRiskCount" INTEGER NOT NULL DEFAULT 0,
    "customerRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "quoteToCashJson" JSONB NOT NULL,
    "pricingDisciplineJson" JSONB NOT NULL,
    "marginLeakageJson" JSONB NOT NULL,
    "invoiceAuditJson" JSONB NOT NULL,
    "customerCommercialJson" JSONB NOT NULL,
    "contractHandoffJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantCommercialRevenueControlPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantCommercialRevenueControlPacket_tenantId_status_updatedAt_idx" ON "AssistantCommercialRevenueControlPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantCommercialRevenueControlPacket_tenantId_commercialScore_updatedAt_idx" ON "AssistantCommercialRevenueControlPacket"("tenantId", "commercialScore", "updatedAt");

ALTER TABLE "AssistantCommercialRevenueControlPacket" ADD CONSTRAINT "AssistantCommercialRevenueControlPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantCommercialRevenueControlPacket" ADD CONSTRAINT "AssistantCommercialRevenueControlPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantCommercialRevenueControlPacket" ADD CONSTRAINT "AssistantCommercialRevenueControlPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
