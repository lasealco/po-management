-- Sprint 11: durable Tenant Rollout & Change Enablement packets.
CREATE TABLE "AssistantTenantRolloutPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "rolloutScore" INTEGER NOT NULL DEFAULT 0,
    "activeUserCount" INTEGER NOT NULL DEFAULT 0,
    "stakeholderGapCount" INTEGER NOT NULL DEFAULT 0,
    "trainingGapCount" INTEGER NOT NULL DEFAULT 0,
    "communicationGapCount" INTEGER NOT NULL DEFAULT 0,
    "supportRiskCount" INTEGER NOT NULL DEFAULT 0,
    "adoptionRiskCount" INTEGER NOT NULL DEFAULT 0,
    "cutoverBlockerCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "tenantProfileJson" JSONB NOT NULL,
    "stakeholderMapJson" JSONB NOT NULL,
    "rolloutWaveJson" JSONB NOT NULL,
    "enablementPlanJson" JSONB NOT NULL,
    "communicationPlanJson" JSONB NOT NULL,
    "adoptionTelemetryJson" JSONB NOT NULL,
    "supportModelJson" JSONB NOT NULL,
    "cutoverChecklistJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantTenantRolloutPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantTenantRolloutPacket_tenantId_status_updatedAt_idx" ON "AssistantTenantRolloutPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantTenantRolloutPacket_tenantId_rolloutScore_updatedAt_idx" ON "AssistantTenantRolloutPacket"("tenantId", "rolloutScore", "updatedAt");

ALTER TABLE "AssistantTenantRolloutPacket" ADD CONSTRAINT "AssistantTenantRolloutPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantTenantRolloutPacket" ADD CONSTRAINT "AssistantTenantRolloutPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantTenantRolloutPacket" ADD CONSTRAINT "AssistantTenantRolloutPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
