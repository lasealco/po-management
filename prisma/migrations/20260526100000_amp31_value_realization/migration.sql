-- AMP31: AI product analytics and value realization assistant persistence.

CREATE TABLE "AssistantValueRealizationPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "valueScore" INTEGER NOT NULL DEFAULT 0,
    "adoptionScore" INTEGER NOT NULL DEFAULT 0,
    "totalEstimatedValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "automationSavings" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "recoveredValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "avoidedCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "roiPct" INTEGER NOT NULL DEFAULT 0,
    "adoptionFunnelJson" JSONB NOT NULL,
    "valueAttributionJson" JSONB NOT NULL,
    "savingsJson" JSONB NOT NULL,
    "serviceImpactJson" JSONB NOT NULL,
    "cohortJson" JSONB NOT NULL,
    "roiAssumptionJson" JSONB NOT NULL,
    "exportReportJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantValueRealizationPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantValueRealizationPacket_tenantId_status_updatedAt_idx" ON "AssistantValueRealizationPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantValueRealizationPacket_tenantId_valueScore_updatedAt_idx" ON "AssistantValueRealizationPacket"("tenantId", "valueScore", "updatedAt");

ALTER TABLE "AssistantValueRealizationPacket" ADD CONSTRAINT "AssistantValueRealizationPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantValueRealizationPacket" ADD CONSTRAINT "AssistantValueRealizationPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantValueRealizationPacket" ADD CONSTRAINT "AssistantValueRealizationPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
