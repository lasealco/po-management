-- AMP8: governed automation policies, shadow runs, pause/enable and rollback audit state.
CREATE TABLE "AssistantAutomationPolicy" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "policyKey" VARCHAR(128) NOT NULL,
  "actionKind" VARCHAR(64) NOT NULL,
  "label" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'SHADOW',
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "threshold" INTEGER NOT NULL DEFAULT 80,
  "guardrailsJson" JSONB NOT NULL,
  "rollbackPlan" TEXT,
  "enabledByUserId" TEXT,
  "enabledAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantAutomationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantAutomationShadowRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "policyId" TEXT,
  "auditEventId" TEXT,
  "actionQueueItemId" TEXT,
  "actionKind" VARCHAR(64) NOT NULL,
  "predictedStatus" VARCHAR(32) NOT NULL,
  "humanStatus" VARCHAR(32),
  "matched" BOOLEAN,
  "wouldExecutePayload" JSONB,
  "runMode" VARCHAR(32) NOT NULL DEFAULT 'SHADOW',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantAutomationShadowRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantAutomationPolicy_tenantId_policyKey_key"
  ON "AssistantAutomationPolicy"("tenantId", "policyKey");
CREATE INDEX "AssistantAutomationPolicy_tenantId_status_updatedAt_idx"
  ON "AssistantAutomationPolicy"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantAutomationPolicy_tenantId_actionKind_status_idx"
  ON "AssistantAutomationPolicy"("tenantId", "actionKind", "status");

CREATE INDEX "AssistantAutomationShadowRun_tenantId_actionKind_createdAt_idx"
  ON "AssistantAutomationShadowRun"("tenantId", "actionKind", "createdAt");
CREATE INDEX "AssistantAutomationShadowRun_tenantId_runMode_createdAt_idx"
  ON "AssistantAutomationShadowRun"("tenantId", "runMode", "createdAt");
CREATE INDEX "AssistantAutomationShadowRun_policyId_createdAt_idx"
  ON "AssistantAutomationShadowRun"("policyId", "createdAt");
CREATE INDEX "AssistantAutomationShadowRun_actionQueueItemId_idx"
  ON "AssistantAutomationShadowRun"("actionQueueItemId");

ALTER TABLE "AssistantAutomationPolicy"
  ADD CONSTRAINT "AssistantAutomationPolicy_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantAutomationPolicy_enabledByUserId_fkey"
  FOREIGN KEY ("enabledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantAutomationShadowRun"
  ADD CONSTRAINT "AssistantAutomationShadowRun_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantAutomationShadowRun_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "AssistantAutomationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantAutomationShadowRun_auditEventId_fkey"
  FOREIGN KEY ("auditEventId") REFERENCES "AssistantAuditEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantAutomationShadowRun_actionQueueItemId_fkey"
  FOREIGN KEY ("actionQueueItemId") REFERENCES "AssistantActionQueueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
