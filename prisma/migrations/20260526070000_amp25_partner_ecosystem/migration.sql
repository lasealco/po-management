-- AMP25: Marketplace and partner ecosystem assistant persistence.

CREATE TABLE "AssistantPartnerEcosystemPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "connectorCount" INTEGER NOT NULL DEFAULT 0,
    "partnerCount" INTEGER NOT NULL DEFAULT 0,
    "mappingIssueCount" INTEGER NOT NULL DEFAULT 0,
    "openReviewCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "connectorReadinessJson" JSONB NOT NULL,
    "partnerScopeJson" JSONB NOT NULL,
    "mappingReviewJson" JSONB NOT NULL,
    "onboardingPlanJson" JSONB NOT NULL,
    "launchChecklistJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPartnerEcosystemPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantPartnerEcosystemPacket_tenantId_status_updatedAt_idx" ON "AssistantPartnerEcosystemPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantPartnerEcosystemPacket_tenantId_readinessScore_updatedAt_idx" ON "AssistantPartnerEcosystemPacket"("tenantId", "readinessScore", "updatedAt");

ALTER TABLE "AssistantPartnerEcosystemPacket" ADD CONSTRAINT "AssistantPartnerEcosystemPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantPartnerEcosystemPacket" ADD CONSTRAINT "AssistantPartnerEcosystemPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantPartnerEcosystemPacket" ADD CONSTRAINT "AssistantPartnerEcosystemPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
