-- Sprint 5: durable Collaboration & Resilience packets.
CREATE TABLE "AssistantCollaborationResiliencePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "resilienceScore" INTEGER NOT NULL DEFAULT 0,
    "partnerGapCount" INTEGER NOT NULL DEFAULT 0,
    "promiseRiskCount" INTEGER NOT NULL DEFAULT 0,
    "climateRiskCount" INTEGER NOT NULL DEFAULT 0,
    "passportGapCount" INTEGER NOT NULL DEFAULT 0,
    "workforceRiskCount" INTEGER NOT NULL DEFAULT 0,
    "safetySignalCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "collaborationHubJson" JSONB NOT NULL,
    "promiseReconciliationJson" JSONB NOT NULL,
    "resiliencePlanJson" JSONB NOT NULL,
    "passportReadinessJson" JSONB NOT NULL,
    "workforceSafetyJson" JSONB NOT NULL,
    "externalRiskJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantCollaborationResiliencePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantCollaborationResiliencePacket_tenantId_status_updatedAt_idx" ON "AssistantCollaborationResiliencePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantCollaborationResiliencePacket_tenantId_resilienceScore_updatedAt_idx" ON "AssistantCollaborationResiliencePacket"("tenantId", "resilienceScore", "updatedAt");

ALTER TABLE "AssistantCollaborationResiliencePacket" ADD CONSTRAINT "AssistantCollaborationResiliencePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantCollaborationResiliencePacket" ADD CONSTRAINT "AssistantCollaborationResiliencePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantCollaborationResiliencePacket" ADD CONSTRAINT "AssistantCollaborationResiliencePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
