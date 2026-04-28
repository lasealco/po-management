-- AMP32: Governed autonomous observe/decide/act/learn operating loop persistence.

CREATE TABLE "AssistantAutonomousOperatingLoop" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "loopScore" INTEGER NOT NULL DEFAULT 0,
    "automationMode" VARCHAR(32) NOT NULL DEFAULT 'REVIEW_ONLY',
    "observedSignalCount" INTEGER NOT NULL DEFAULT 0,
    "decisionCount" INTEGER NOT NULL DEFAULT 0,
    "proposedActionCount" INTEGER NOT NULL DEFAULT 0,
    "approvedAutomationCount" INTEGER NOT NULL DEFAULT 0,
    "anomalyCount" INTEGER NOT NULL DEFAULT 0,
    "learningCount" INTEGER NOT NULL DEFAULT 0,
    "observeJson" JSONB NOT NULL,
    "decideJson" JSONB NOT NULL,
    "actJson" JSONB NOT NULL,
    "learnJson" JSONB NOT NULL,
    "policyJson" JSONB NOT NULL,
    "outcomeJson" JSONB NOT NULL,
    "rollbackJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantAutonomousOperatingLoop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantAutonomousOperatingLoop_tenantId_status_updatedAt_idx" ON "AssistantAutonomousOperatingLoop"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantAutonomousOperatingLoop_tenantId_automationMode_updatedAt_idx" ON "AssistantAutonomousOperatingLoop"("tenantId", "automationMode", "updatedAt");
CREATE INDEX "AssistantAutonomousOperatingLoop_tenantId_loopScore_updatedAt_idx" ON "AssistantAutonomousOperatingLoop"("tenantId", "loopScore", "updatedAt");

ALTER TABLE "AssistantAutonomousOperatingLoop" ADD CONSTRAINT "AssistantAutonomousOperatingLoop_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantAutonomousOperatingLoop" ADD CONSTRAINT "AssistantAutonomousOperatingLoop_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantAutonomousOperatingLoop" ADD CONSTRAINT "AssistantAutonomousOperatingLoop_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
