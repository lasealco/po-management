-- AMP17: cross-module exception incident rooms with linked evidence, blast radius, playbook, and closure notes.
CREATE TABLE "AssistantExceptionIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "severity" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    "incidentKey" VARCHAR(256) NOT NULL,
    "severityScore" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "linkedObjectsJson" JSONB NOT NULL,
    "blastRadiusJson" JSONB NOT NULL,
    "timelineJson" JSONB NOT NULL,
    "playbookJson" JSONB NOT NULL,
    "communicationDraftJson" JSONB NOT NULL,
    "customerImpact" TEXT,
    "rootCauseNote" TEXT,
    "actionQueueItemId" TEXT,
    "mergedIntoIncidentId" TEXT,
    "splitFromIncidentId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantExceptionIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantExceptionIncident_tenantId_status_severity_updatedAt_idx" ON "AssistantExceptionIncident"("tenantId", "status", "severity", "updatedAt");
CREATE INDEX "AssistantExceptionIncident_tenantId_incidentKey_idx" ON "AssistantExceptionIncident"("tenantId", "incidentKey");
CREATE INDEX "AssistantExceptionIncident_tenantId_mergedIntoIncidentId_idx" ON "AssistantExceptionIncident"("tenantId", "mergedIntoIncidentId");

ALTER TABLE "AssistantExceptionIncident"
    ADD CONSTRAINT "AssistantExceptionIncident_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantExceptionIncident"
    ADD CONSTRAINT "AssistantExceptionIncident_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
