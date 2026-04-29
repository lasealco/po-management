-- Sprint 9: durable Data & Integration Control Plane packets.
CREATE TABLE "AssistantDataIntegrationPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "integrationScore" INTEGER NOT NULL DEFAULT 0,
    "connectorCount" INTEGER NOT NULL DEFAULT 0,
    "blockedConnectorCount" INTEGER NOT NULL DEFAULT 0,
    "mappingGapCount" INTEGER NOT NULL DEFAULT 0,
    "stagingRiskCount" INTEGER NOT NULL DEFAULT 0,
    "masterDataRiskCount" INTEGER NOT NULL DEFAULT 0,
    "twinIngestRiskCount" INTEGER NOT NULL DEFAULT 0,
    "launchActionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "connectorReadinessJson" JSONB NOT NULL,
    "dataContractJson" JSONB NOT NULL,
    "mappingReviewJson" JSONB NOT NULL,
    "stagingReviewJson" JSONB NOT NULL,
    "masterDataQualityJson" JSONB NOT NULL,
    "twinIngestJson" JSONB NOT NULL,
    "launchChecklistJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantDataIntegrationPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantDataIntegrationPacket_tenantId_status_updatedAt_idx" ON "AssistantDataIntegrationPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantDataIntegrationPacket_tenantId_integrationScore_updatedAt_idx" ON "AssistantDataIntegrationPacket"("tenantId", "integrationScore", "updatedAt");

ALTER TABLE "AssistantDataIntegrationPacket" ADD CONSTRAINT "AssistantDataIntegrationPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantDataIntegrationPacket" ADD CONSTRAINT "AssistantDataIntegrationPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantDataIntegrationPacket" ADD CONSTRAINT "AssistantDataIntegrationPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
