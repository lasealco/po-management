-- AMP10: Supply Chain Twin assistant insights linking graph confidence, scenarios, risks, and human work.
CREATE TABLE "SupplyChainTwinAssistantInsight" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "prompt" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "graphConfidenceScore" INTEGER NOT NULL DEFAULT 0,
  "scenarioDraftId" TEXT,
  "riskSignalId" TEXT,
  "actionQueueItemId" TEXT,
  "assistantEvidenceRecordId" TEXT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  "evidenceJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplyChainTwinAssistantInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyChainTwinAssistantInsight_tenantId_status_createdAt_idx"
  ON "SupplyChainTwinAssistantInsight"("tenantId", "status", "createdAt");
CREATE INDEX "SupplyChainTwinAssistantInsight_tenantId_scenarioDraftId_idx"
  ON "SupplyChainTwinAssistantInsight"("tenantId", "scenarioDraftId");
CREATE INDEX "SupplyChainTwinAssistantInsight_tenantId_riskSignalId_idx"
  ON "SupplyChainTwinAssistantInsight"("tenantId", "riskSignalId");

ALTER TABLE "SupplyChainTwinAssistantInsight"
  ADD CONSTRAINT "SupplyChainTwinAssistantInsight_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplyChainTwinAssistantInsight_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
