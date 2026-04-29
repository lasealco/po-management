-- Sprint 17: Cross-Domain Exception & Incident Nerve Center
CREATE TABLE "AssistantIncidentNerveCenterPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "nerveScore" INTEGER NOT NULL DEFAULT 0,
    "controlTowerRiskCount" INTEGER NOT NULL DEFAULT 0,
    "crossModuleIncidentCount" INTEGER NOT NULL DEFAULT 0,
    "blastRadiusSignalCount" INTEGER NOT NULL DEFAULT 0,
    "recoveryGapCount" INTEGER NOT NULL DEFAULT 0,
    "observabilityRiskCount" INTEGER NOT NULL DEFAULT 0,
    "twinRiskCount" INTEGER NOT NULL DEFAULT 0,
    "financeIntegrationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "controlTowerJson" JSONB NOT NULL,
    "crossModuleJson" JSONB NOT NULL,
    "blastRadiusJson" JSONB NOT NULL,
    "playbookRecoveryJson" JSONB NOT NULL,
    "observabilityTwinJson" JSONB NOT NULL,
    "financeIntegrationJson" JSONB NOT NULL,
    "dedupeMergeJson" JSONB NOT NULL,
    "customerCommsJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantIncidentNerveCenterPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantIncidentNerveCenterPacket_tenantId_status_updatedAt_idx" ON "AssistantIncidentNerveCenterPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantIncidentNerveCenterPacket_tenantId_nerveScore_updatedAt_idx" ON "AssistantIncidentNerveCenterPacket"("tenantId", "nerveScore", "updatedAt");

ALTER TABLE "AssistantIncidentNerveCenterPacket" ADD CONSTRAINT "AssistantIncidentNerveCenterPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantIncidentNerveCenterPacket" ADD CONSTRAINT "AssistantIncidentNerveCenterPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantIncidentNerveCenterPacket" ADD CONSTRAINT "AssistantIncidentNerveCenterPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
