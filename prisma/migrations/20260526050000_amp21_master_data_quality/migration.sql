-- AMP21: Master data quality assistant persistence.

CREATE TABLE "AssistantMasterDataQualityRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "gapCount" INTEGER NOT NULL DEFAULT 0,
    "staleCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB NOT NULL,
    "duplicateGroupsJson" JSONB NOT NULL,
    "gapAnalysisJson" JSONB NOT NULL,
    "staleRecordsJson" JSONB NOT NULL,
    "conflictJson" JSONB NOT NULL,
    "enrichmentPlanJson" JSONB NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantMasterDataQualityRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantMasterDataQualityRun_tenantId_status_updatedAt_idx" ON "AssistantMasterDataQualityRun"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantMasterDataQualityRun_tenantId_qualityScore_updatedAt_idx" ON "AssistantMasterDataQualityRun"("tenantId", "qualityScore", "updatedAt");

ALTER TABLE "AssistantMasterDataQualityRun" ADD CONSTRAINT "AssistantMasterDataQualityRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantMasterDataQualityRun" ADD CONSTRAINT "AssistantMasterDataQualityRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantMasterDataQualityRun" ADD CONSTRAINT "AssistantMasterDataQualityRun_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
