-- AMP24: Sustainability and ESG assistant persistence.

CREATE TABLE "AssistantSustainabilityPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "sustainabilityScore" INTEGER NOT NULL DEFAULT 0,
    "estimatedCo2eKg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "potentialSavingsKg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "missingDataCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "shipmentSummaryJson" JSONB NOT NULL,
    "warehouseSummaryJson" JSONB NOT NULL,
    "emissionsJson" JSONB NOT NULL,
    "missingDataJson" JSONB NOT NULL,
    "recommendationJson" JSONB NOT NULL,
    "assumptionsJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSustainabilityPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantSustainabilityPacket_tenantId_status_updatedAt_idx" ON "AssistantSustainabilityPacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantSustainabilityPacket_tenantId_sustainabilityScore_updatedAt_idx" ON "AssistantSustainabilityPacket"("tenantId", "sustainabilityScore", "updatedAt");

ALTER TABLE "AssistantSustainabilityPacket" ADD CONSTRAINT "AssistantSustainabilityPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantSustainabilityPacket" ADD CONSTRAINT "AssistantSustainabilityPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantSustainabilityPacket" ADD CONSTRAINT "AssistantSustainabilityPacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
