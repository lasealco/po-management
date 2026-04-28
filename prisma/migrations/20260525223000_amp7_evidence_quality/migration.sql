-- AMP7: evidence ledger, review examples, prompt library, and release gates.
CREATE TABLE "AssistantEvidenceRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "auditEventId" TEXT,
  "label" TEXT NOT NULL,
  "href" TEXT,
  "excerpt" TEXT,
  "sourceType" VARCHAR(32) NOT NULL DEFAULT 'LINK',
  "confidence" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  "createdByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantEvidenceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantReviewExample" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "auditEventId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "label" VARCHAR(32) NOT NULL,
  "correctionNote" TEXT,
  "exportJson" JSONB,
  "status" VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantReviewExample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantPromptLibraryItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "roleScope" VARCHAR(64),
  "domain" VARCHAR(64),
  "objectType" VARCHAR(64),
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantPromptLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantReleaseGate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "gateKey" VARCHAR(128) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'BLOCKED',
  "score" INTEGER NOT NULL DEFAULT 0,
  "threshold" INTEGER NOT NULL DEFAULT 75,
  "checksJson" JSONB NOT NULL,
  "notes" TEXT,
  "evaluatedByUserId" TEXT,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantReleaseGate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantEvidenceRecord_tenantId_auditEventId_createdAt_idx"
  ON "AssistantEvidenceRecord"("tenantId", "auditEventId", "createdAt");
CREATE INDEX "AssistantEvidenceRecord_tenantId_sourceType_createdAt_idx"
  ON "AssistantEvidenceRecord"("tenantId", "sourceType", "createdAt");
CREATE INDEX "AssistantEvidenceRecord_tenantId_archivedAt_createdAt_idx"
  ON "AssistantEvidenceRecord"("tenantId", "archivedAt", "createdAt");

CREATE INDEX "AssistantReviewExample_tenantId_status_createdAt_idx"
  ON "AssistantReviewExample"("tenantId", "status", "createdAt");
CREATE INDEX "AssistantReviewExample_tenantId_label_createdAt_idx"
  ON "AssistantReviewExample"("tenantId", "label", "createdAt");
CREATE INDEX "AssistantReviewExample_auditEventId_idx"
  ON "AssistantReviewExample"("auditEventId");

CREATE INDEX "AssistantPromptLibraryItem_tenantId_status_updatedAt_idx"
  ON "AssistantPromptLibraryItem"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantPromptLibraryItem_tenantId_domain_status_idx"
  ON "AssistantPromptLibraryItem"("tenantId", "domain", "status");
CREATE INDEX "AssistantPromptLibraryItem_tenantId_objectType_status_idx"
  ON "AssistantPromptLibraryItem"("tenantId", "objectType", "status");

CREATE INDEX "AssistantReleaseGate_tenantId_gateKey_evaluatedAt_idx"
  ON "AssistantReleaseGate"("tenantId", "gateKey", "evaluatedAt");
CREATE INDEX "AssistantReleaseGate_tenantId_status_evaluatedAt_idx"
  ON "AssistantReleaseGate"("tenantId", "status", "evaluatedAt");

ALTER TABLE "AssistantEvidenceRecord"
  ADD CONSTRAINT "AssistantEvidenceRecord_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantEvidenceRecord_auditEventId_fkey"
  FOREIGN KEY ("auditEventId") REFERENCES "AssistantAuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantEvidenceRecord_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantReviewExample"
  ADD CONSTRAINT "AssistantReviewExample_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantReviewExample_auditEventId_fkey"
  FOREIGN KEY ("auditEventId") REFERENCES "AssistantAuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantReviewExample_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantPromptLibraryItem"
  ADD CONSTRAINT "AssistantPromptLibraryItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantPromptLibraryItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssistantReleaseGate"
  ADD CONSTRAINT "AssistantReleaseGate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssistantReleaseGate_evaluatedByUserId_fkey"
  FOREIGN KEY ("evaluatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
