-- AMP22: AI planning and S&OP bridge persistence.

CREATE TABLE "AssistantPlanningPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "planningScore" INTEGER NOT NULL DEFAULT 0,
    "horizonDays" INTEGER NOT NULL DEFAULT 30,
    "demandUnits" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "availableUnits" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "inboundUnits" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "shortageUnits" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "demandSummaryJson" JSONB NOT NULL,
    "supplySummaryJson" JSONB NOT NULL,
    "gapAnalysisJson" JSONB NOT NULL,
    "constraintJson" JSONB NOT NULL,
    "scenarioJson" JSONB NOT NULL,
    "recommendationJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "scenarioDraftId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPlanningPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantPlanningPacket_tenantId_status_updatedAt_idx" ON "AssistantPlanningPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantPlanningPacket_tenantId_planningScore_updatedAt_idx" ON "AssistantPlanningPacket"("tenantId", "planningScore", "updatedAt");
CREATE INDEX "AssistantPlanningPacket_tenantId_scenarioDraftId_idx" ON "AssistantPlanningPacket"("tenantId", "scenarioDraftId");

ALTER TABLE "AssistantPlanningPacket" ADD CONSTRAINT "AssistantPlanningPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantPlanningPacket" ADD CONSTRAINT "AssistantPlanningPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantPlanningPacket" ADD CONSTRAINT "AssistantPlanningPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
