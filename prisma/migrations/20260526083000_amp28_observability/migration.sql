-- AMP28: AI observability and incident response persistence.

CREATE TABLE "AssistantObservabilityIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "severity" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    "healthScore" INTEGER NOT NULL DEFAULT 0,
    "auditEventCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "driftSignalCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceGapCount" INTEGER NOT NULL DEFAULT 0,
    "automationRiskCount" INTEGER NOT NULL DEFAULT 0,
    "healthSnapshotJson" JSONB NOT NULL,
    "failureSignalJson" JSONB NOT NULL,
    "driftSignalJson" JSONB NOT NULL,
    "evidenceCoverageJson" JSONB NOT NULL,
    "automationRiskJson" JSONB NOT NULL,
    "degradedModeJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "postmortemJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantObservabilityIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantObservabilityIncident_tenantId_status_severity_updatedAt_idx" ON "AssistantObservabilityIncident"("tenantId", "status", "severity", "updatedAt");
CREATE INDEX "AssistantObservabilityIncident_tenantId_healthScore_updatedAt_idx" ON "AssistantObservabilityIncident"("tenantId", "healthScore", "updatedAt");

ALTER TABLE "AssistantObservabilityIncident" ADD CONSTRAINT "AssistantObservabilityIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantObservabilityIncident" ADD CONSTRAINT "AssistantObservabilityIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantObservabilityIncident" ADD CONSTRAINT "AssistantObservabilityIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
