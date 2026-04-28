-- AMP26: Mobile and frontline assistant persistence.

CREATE TABLE "AssistantFrontlinePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "frontlineTaskCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "quickActionCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceGapCount" INTEGER NOT NULL DEFAULT 0,
    "offlineRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "frontlineQueueJson" JSONB NOT NULL,
    "quickActionJson" JSONB NOT NULL,
    "evidenceChecklistJson" JSONB NOT NULL,
    "offlineRiskJson" JSONB NOT NULL,
    "permissionScopeJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantFrontlinePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantFrontlinePacket_tenantId_status_updatedAt_idx" ON "AssistantFrontlinePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantFrontlinePacket_tenantId_readinessScore_updatedAt_idx" ON "AssistantFrontlinePacket"("tenantId", "readinessScore", "updatedAt");

ALTER TABLE "AssistantFrontlinePacket" ADD CONSTRAINT "AssistantFrontlinePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantFrontlinePacket" ADD CONSTRAINT "AssistantFrontlinePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantFrontlinePacket" ADD CONSTRAINT "AssistantFrontlinePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
