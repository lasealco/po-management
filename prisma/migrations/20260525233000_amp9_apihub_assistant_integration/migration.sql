-- AMP9: API Hub assistant review items linking external-data evidence to human work.
CREATE TABLE "ApiHubAssistantReviewItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "sourceType" VARCHAR(64) NOT NULL,
  "sourceId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'INFO',
  "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  "evidenceJson" JSONB NOT NULL,
  "actionQueueItemId" TEXT,
  "assistantEvidenceRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiHubAssistantReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiHubAssistantReviewItem_tenantId_status_severity_createdAt_idx"
  ON "ApiHubAssistantReviewItem"("tenantId", "status", "severity", "createdAt");
CREATE INDEX "ApiHubAssistantReviewItem_tenantId_sourceType_sourceId_idx"
  ON "ApiHubAssistantReviewItem"("tenantId", "sourceType", "sourceId");
CREATE INDEX "ApiHubAssistantReviewItem_actionQueueItemId_idx"
  ON "ApiHubAssistantReviewItem"("actionQueueItemId");

ALTER TABLE "ApiHubAssistantReviewItem"
  ADD CONSTRAINT "ApiHubAssistantReviewItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ApiHubAssistantReviewItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
