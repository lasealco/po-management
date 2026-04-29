-- Sprint 8: durable Warehouse & Fulfillment Autonomy packets.
CREATE TABLE "AssistantWarehouseFulfillmentPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "autonomyScore" INTEGER NOT NULL DEFAULT 0,
    "warehouseCount" INTEGER NOT NULL DEFAULT 0,
    "openTaskCount" INTEGER NOT NULL DEFAULT 0,
    "agedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "waveRiskCount" INTEGER NOT NULL DEFAULT 0,
    "outboundRiskCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "recoveryActionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "capacityPostureJson" JSONB NOT NULL,
    "taskRecoveryJson" JSONB NOT NULL,
    "waveHealthJson" JSONB NOT NULL,
    "outboundFulfillmentJson" JSONB NOT NULL,
    "exceptionEvidenceJson" JSONB NOT NULL,
    "supervisorActionJson" JSONB NOT NULL,
    "mobileWorkJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantWarehouseFulfillmentPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantWarehouseFulfillmentPacket_tenantId_status_updatedAt_idx" ON "AssistantWarehouseFulfillmentPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantWarehouseFulfillmentPacket_tenantId_autonomyScore_updatedAt_idx" ON "AssistantWarehouseFulfillmentPacket"("tenantId", "autonomyScore", "updatedAt");

ALTER TABLE "AssistantWarehouseFulfillmentPacket" ADD CONSTRAINT "AssistantWarehouseFulfillmentPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantWarehouseFulfillmentPacket" ADD CONSTRAINT "AssistantWarehouseFulfillmentPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantWarehouseFulfillmentPacket" ADD CONSTRAINT "AssistantWarehouseFulfillmentPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
