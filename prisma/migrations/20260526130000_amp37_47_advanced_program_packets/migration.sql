-- AMP37-47: shared durable packets for advanced assistant programs.

CREATE TABLE "AssistantAdvancedProgramPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "ampNumber" INTEGER NOT NULL,
    "programKey" VARCHAR(96) NOT NULL,
    "programTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "programScore" INTEGER NOT NULL DEFAULT 0,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "approvalStepCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "assessmentJson" JSONB NOT NULL,
    "recommendationJson" JSONB NOT NULL,
    "approvalPlanJson" JSONB NOT NULL,
    "artifactJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantAdvancedProgramPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantAdvancedProgramPacket_tenantId_programKey_status_updatedAt_idx" ON "AssistantAdvancedProgramPacket"("tenantId", "programKey", "status", "updatedAt");
CREATE INDEX "AssistantAdvancedProgramPacket_tenantId_ampNumber_updatedAt_idx" ON "AssistantAdvancedProgramPacket"("tenantId", "ampNumber", "updatedAt");
CREATE INDEX "AssistantAdvancedProgramPacket_tenantId_programScore_updatedAt_idx" ON "AssistantAdvancedProgramPacket"("tenantId", "programScore", "updatedAt");

ALTER TABLE "AssistantAdvancedProgramPacket" ADD CONSTRAINT "AssistantAdvancedProgramPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantAdvancedProgramPacket" ADD CONSTRAINT "AssistantAdvancedProgramPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantAdvancedProgramPacket" ADD CONSTRAINT "AssistantAdvancedProgramPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
