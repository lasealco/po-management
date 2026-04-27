-- MP15-MP19: persistent assistant audit, action queue, memory, and playbook state.
CREATE TABLE "AssistantAuditEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "surface" VARCHAR(64) NOT NULL DEFAULT 'dock',
  "prompt" TEXT NOT NULL,
  "answerKind" VARCHAR(32) NOT NULL,
  "message" TEXT,
  "evidence" JSONB,
  "quality" JSONB,
  "actions" JSONB,
  "playbook" JSONB,
  "objectType" VARCHAR(64),
  "objectId" TEXT,
  "feedback" VARCHAR(32),
  "feedbackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantActionQueueItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "auditEventId" TEXT,
  "objectType" VARCHAR(64),
  "objectId" TEXT,
  "actionId" VARCHAR(128) NOT NULL,
  "actionKind" VARCHAR(64) NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "payload" JSONB,
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantActionQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantPlaybookRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "auditEventId" TEXT,
  "objectType" VARCHAR(64),
  "objectId" TEXT,
  "playbookId" VARCHAR(128) NOT NULL,
  "title" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
  "steps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantPlaybookRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantAuditEvent_tenantId_createdAt_idx" ON "AssistantAuditEvent"("tenantId", "createdAt");
CREATE INDEX "AssistantAuditEvent_tenantId_actorUserId_createdAt_idx" ON "AssistantAuditEvent"("tenantId", "actorUserId", "createdAt");
CREATE INDEX "AssistantAuditEvent_tenantId_objectType_objectId_createdAt_idx" ON "AssistantAuditEvent"("tenantId", "objectType", "objectId", "createdAt");
CREATE INDEX "AssistantAuditEvent_tenantId_feedback_createdAt_idx" ON "AssistantAuditEvent"("tenantId", "feedback", "createdAt");

CREATE INDEX "AssistantActionQueueItem_tenantId_status_createdAt_idx" ON "AssistantActionQueueItem"("tenantId", "status", "createdAt");
CREATE INDEX "AssistantActionQueueItem_tenantId_actorUserId_createdAt_idx" ON "AssistantActionQueueItem"("tenantId", "actorUserId", "createdAt");
CREATE INDEX "AssistantActionQueueItem_tenantId_objectType_objectId_createdAt_idx" ON "AssistantActionQueueItem"("tenantId", "objectType", "objectId", "createdAt");
CREATE INDEX "AssistantActionQueueItem_auditEventId_idx" ON "AssistantActionQueueItem"("auditEventId");

CREATE INDEX "AssistantPlaybookRun_tenantId_playbookId_createdAt_idx" ON "AssistantPlaybookRun"("tenantId", "playbookId", "createdAt");
CREATE INDEX "AssistantPlaybookRun_tenantId_actorUserId_createdAt_idx" ON "AssistantPlaybookRun"("tenantId", "actorUserId", "createdAt");
CREATE INDEX "AssistantPlaybookRun_tenantId_objectType_objectId_createdAt_idx" ON "AssistantPlaybookRun"("tenantId", "objectType", "objectId", "createdAt");
CREATE INDEX "AssistantPlaybookRun_auditEventId_idx" ON "AssistantPlaybookRun"("auditEventId");

ALTER TABLE "AssistantAuditEvent" ADD CONSTRAINT "AssistantAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantAuditEvent" ADD CONSTRAINT "AssistantAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantActionQueueItem" ADD CONSTRAINT "AssistantActionQueueItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantActionQueueItem" ADD CONSTRAINT "AssistantActionQueueItem_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantActionQueueItem" ADD CONSTRAINT "AssistantActionQueueItem_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AssistantAuditEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantPlaybookRun" ADD CONSTRAINT "AssistantPlaybookRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantPlaybookRun" ADD CONSTRAINT "AssistantPlaybookRun_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantPlaybookRun" ADD CONSTRAINT "AssistantPlaybookRun_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AssistantAuditEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
