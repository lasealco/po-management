-- P2: async mapping analysis jobs (deterministic heuristic; LLM slot later)

CREATE TABLE "ApiHubMappingAnalysisJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inputPayload" JSONB NOT NULL,
    "outputProposal" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ApiHubMappingAnalysisJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiHubMappingAnalysisJob_tenantId_createdAt_idx" ON "ApiHubMappingAnalysisJob"("tenantId", "createdAt");

CREATE INDEX "ApiHubMappingAnalysisJob_tenantId_status_createdAt_idx" ON "ApiHubMappingAnalysisJob"("tenantId", "status", "createdAt");

ALTER TABLE "ApiHubMappingAnalysisJob" ADD CONSTRAINT "ApiHubMappingAnalysisJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubMappingAnalysisJob" ADD CONSTRAINT "ApiHubMappingAnalysisJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
