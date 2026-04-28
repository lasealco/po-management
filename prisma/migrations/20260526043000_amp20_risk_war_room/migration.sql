-- AMP20: Risk intelligence war room persistence.

CREATE TABLE "AssistantRiskWarRoom" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "severity" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "primaryScriEventId" TEXT,
    "scenarioDraftId" TEXT,
    "riskSignalId" TEXT,
    "eventClusterJson" JSONB NOT NULL,
    "exposureMapJson" JSONB NOT NULL,
    "scenarioProposalJson" JSONB NOT NULL,
    "mitigationPlanJson" JSONB NOT NULL,
    "communicationDraftJson" JSONB NOT NULL,
    "actionQueueItemId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantRiskWarRoom_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantRiskWarRoom_tenantId_status_severity_updatedAt_idx" ON "AssistantRiskWarRoom"("tenantId", "status", "severity", "updatedAt");
CREATE INDEX "AssistantRiskWarRoom_tenantId_primaryScriEventId_idx" ON "AssistantRiskWarRoom"("tenantId", "primaryScriEventId");
CREATE INDEX "AssistantRiskWarRoom_tenantId_scenarioDraftId_idx" ON "AssistantRiskWarRoom"("tenantId", "scenarioDraftId");

ALTER TABLE "AssistantRiskWarRoom" ADD CONSTRAINT "AssistantRiskWarRoom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantRiskWarRoom" ADD CONSTRAINT "AssistantRiskWarRoom_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantRiskWarRoom" ADD CONSTRAINT "AssistantRiskWarRoom_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
