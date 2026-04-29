-- Sprint 14: Platform Reliability & Security Operations
CREATE TABLE "AssistantPlatformReliabilityPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "reliabilityScore" INTEGER NOT NULL DEFAULT 0,
    "openIncidentCount" INTEGER NOT NULL DEFAULT 0,
    "securityRiskCount" INTEGER NOT NULL DEFAULT 0,
    "connectorRiskCount" INTEGER NOT NULL DEFAULT 0,
    "automationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "changeBlockerCount" INTEGER NOT NULL DEFAULT 0,
    "operationalActionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "reliabilityPostureJson" JSONB NOT NULL,
    "securityOperationsJson" JSONB NOT NULL,
    "connectorHealthJson" JSONB NOT NULL,
    "automationSafetyJson" JSONB NOT NULL,
    "incidentReadinessJson" JSONB NOT NULL,
    "releaseChangeControlJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPlatformReliabilityPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantPlatformReliabilityPacket_tenantId_status_updatedAt_idx" ON "AssistantPlatformReliabilityPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantPlatformReliabilityPacket_tenantId_reliabilityScore_updatedAt_idx" ON "AssistantPlatformReliabilityPacket"("tenantId", "reliabilityScore", "updatedAt");

ALTER TABLE "AssistantPlatformReliabilityPacket" ADD CONSTRAINT "AssistantPlatformReliabilityPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantPlatformReliabilityPacket" ADD CONSTRAINT "AssistantPlatformReliabilityPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantPlatformReliabilityPacket" ADD CONSTRAINT "AssistantPlatformReliabilityPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
