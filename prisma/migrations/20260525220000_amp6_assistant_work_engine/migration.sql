-- AMP6: assistant work engine assignment, playbook templates, SLA state, and memory cleanup.
ALTER TABLE "AssistantAuditEvent"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archiveReason" TEXT;

ALTER TABLE "AssistantActionQueueItem"
  ADD COLUMN "objectHref" TEXT,
  ADD COLUMN "ownerUserId" TEXT,
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "priority" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "decisionNote" TEXT;

ALTER TABLE "AssistantPlaybookRun"
  ADD COLUMN "ownerUserId" TEXT,
  ADD COLUMN "objectHref" TEXT,
  ADD COLUMN "priority" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "AssistantPlaybookTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "playbookId" VARCHAR(128) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "objectType" VARCHAR(64),
  "priority" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  "slaHours" INTEGER,
  "steps" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantPlaybookTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantPlaybookTemplate_tenantId_playbookId_key"
  ON "AssistantPlaybookTemplate"("tenantId", "playbookId");
CREATE INDEX "AssistantPlaybookTemplate_tenantId_isActive_updatedAt_idx"
  ON "AssistantPlaybookTemplate"("tenantId", "isActive", "updatedAt");
CREATE INDEX "AssistantPlaybookTemplate_tenantId_objectType_isActive_idx"
  ON "AssistantPlaybookTemplate"("tenantId", "objectType", "isActive");

CREATE INDEX "AssistantAuditEvent_tenantId_archivedAt_createdAt_idx"
  ON "AssistantAuditEvent"("tenantId", "archivedAt", "createdAt");
CREATE INDEX "AssistantActionQueueItem_tenantId_status_priority_dueAt_idx"
  ON "AssistantActionQueueItem"("tenantId", "status", "priority", "dueAt");
CREATE INDEX "AssistantActionQueueItem_tenantId_ownerUserId_status_dueAt_idx"
  ON "AssistantActionQueueItem"("tenantId", "ownerUserId", "status", "dueAt");
CREATE INDEX "AssistantPlaybookRun_tenantId_status_priority_dueAt_idx"
  ON "AssistantPlaybookRun"("tenantId", "status", "priority", "dueAt");
CREATE INDEX "AssistantPlaybookRun_tenantId_ownerUserId_status_dueAt_idx"
  ON "AssistantPlaybookRun"("tenantId", "ownerUserId", "status", "dueAt");

ALTER TABLE "AssistantActionQueueItem"
  ADD CONSTRAINT "AssistantActionQueueItem_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantPlaybookRun"
  ADD CONSTRAINT "AssistantPlaybookRun_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantPlaybookTemplate"
  ADD CONSTRAINT "AssistantPlaybookTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantPlaybookTemplate_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
