-- Sprint 20: External Risk & Event Intelligence (SCRI)
CREATE TABLE "AssistantExternalRiskEventPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "eventIntelligenceScore" INTEGER NOT NULL DEFAULT 0,
    "eventReviewRiskCount" INTEGER NOT NULL DEFAULT 0,
    "exposureLinkageRiskCount" INTEGER NOT NULL DEFAULT 0,
    "twinScenarioRiskCount" INTEGER NOT NULL DEFAULT 0,
    "mitigationRecommendationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "coordinationEscalationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "credibilityRiskCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "externalEventJson" JSONB NOT NULL,
    "exposureMappingJson" JSONB NOT NULL,
    "twinScenarioJson" JSONB NOT NULL,
    "mitigationPortfolioJson" JSONB NOT NULL,
    "escalationCadenceJson" JSONB NOT NULL,
    "credibilityJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantExternalRiskEventPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantExternalRiskEventPacket_tenantId_status_updatedAt_idx" ON "AssistantExternalRiskEventPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantExternalRiskEventPacket_tenantId_eventIntelligenceScore_updatedAt_idx" ON "AssistantExternalRiskEventPacket"("tenantId", "eventIntelligenceScore", "updatedAt");

ALTER TABLE "AssistantExternalRiskEventPacket" ADD CONSTRAINT "AssistantExternalRiskEventPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantExternalRiskEventPacket" ADD CONSTRAINT "AssistantExternalRiskEventPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantExternalRiskEventPacket" ADD CONSTRAINT "AssistantExternalRiskEventPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
