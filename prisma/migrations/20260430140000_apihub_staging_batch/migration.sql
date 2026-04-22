-- P2+: materialized staging rows from mapping analysis / ingestion prep

CREATE TABLE "ApiHubStagingBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "sourceMappingAnalysisJobId" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiHubStagingBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiHubStagingRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "sourceRecord" JSONB,
    "mappedRecord" JSONB,
    "issues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiHubStagingRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiHubStagingRow_batchId_rowIndex_key" ON "ApiHubStagingRow"("batchId", "rowIndex");

CREATE INDEX "ApiHubStagingBatch_tenantId_createdAt_idx" ON "ApiHubStagingBatch"("tenantId", "createdAt");

CREATE INDEX "ApiHubStagingBatch_tenantId_status_createdAt_idx" ON "ApiHubStagingBatch"("tenantId", "status", "createdAt");

CREATE INDEX "ApiHubStagingRow_tenantId_batchId_idx" ON "ApiHubStagingRow"("tenantId", "batchId");

ALTER TABLE "ApiHubStagingBatch" ADD CONSTRAINT "ApiHubStagingBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubStagingBatch" ADD CONSTRAINT "ApiHubStagingBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApiHubStagingBatch" ADD CONSTRAINT "ApiHubStagingBatch_sourceMappingAnalysisJobId_fkey" FOREIGN KEY ("sourceMappingAnalysisJobId") REFERENCES "ApiHubMappingAnalysisJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiHubStagingRow" ADD CONSTRAINT "ApiHubStagingRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubStagingRow" ADD CONSTRAINT "ApiHubStagingRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ApiHubStagingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
