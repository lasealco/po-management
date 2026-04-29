-- Sprint 16: Transportation & Carrier Procurement Command
CREATE TABLE "AssistantTransportCarrierProcurementPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "procurementScore" INTEGER NOT NULL DEFAULT 0,
    "rfqRiskCount" INTEGER NOT NULL DEFAULT 0,
    "tariffBookingRiskCount" INTEGER NOT NULL DEFAULT 0,
    "laneRiskCount" INTEGER NOT NULL DEFAULT 0,
    "tenderRiskCount" INTEGER NOT NULL DEFAULT 0,
    "invoiceVarianceCount" INTEGER NOT NULL DEFAULT 0,
    "executionRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "rfqTariffJson" JSONB NOT NULL,
    "bookingPricingJson" JSONB NOT NULL,
    "laneExecutionJson" JSONB NOT NULL,
    "carrierPerformanceJson" JSONB NOT NULL,
    "tenderAllocationJson" JSONB NOT NULL,
    "invoiceFeedbackJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantTransportCarrierProcurementPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantTransportCarrierProcurementPacket_tenantId_status_updatedAt_idx" ON "AssistantTransportCarrierProcurementPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantTransportCarrierProcurementPacket_tenantId_procurementScore_updatedAt_idx" ON "AssistantTransportCarrierProcurementPacket"("tenantId", "procurementScore", "updatedAt");

ALTER TABLE "AssistantTransportCarrierProcurementPacket" ADD CONSTRAINT "AssistantTransportCarrierProcurementPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantTransportCarrierProcurementPacket" ADD CONSTRAINT "AssistantTransportCarrierProcurementPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantTransportCarrierProcurementPacket" ADD CONSTRAINT "AssistantTransportCarrierProcurementPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
