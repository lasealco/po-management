-- Sprint 13: Product Lifecycle & Compliance Passport
CREATE TABLE "AssistantProductLifecyclePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "lifecycleScore" INTEGER NOT NULL DEFAULT 0,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "passportGapCount" INTEGER NOT NULL DEFAULT 0,
    "documentRiskCount" INTEGER NOT NULL DEFAULT 0,
    "supplierComplianceGapCount" INTEGER NOT NULL DEFAULT 0,
    "sustainabilityGapCount" INTEGER NOT NULL DEFAULT 0,
    "lifecycleActionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceSummaryJson" JSONB NOT NULL,
    "catalogReadinessJson" JSONB NOT NULL,
    "passportEvidenceJson" JSONB NOT NULL,
    "supplierComplianceJson" JSONB NOT NULL,
    "sustainabilityPassportJson" JSONB NOT NULL,
    "lifecycleRiskJson" JSONB NOT NULL,
    "releaseChecklistJson" JSONB NOT NULL,
    "responsePlanJson" JSONB NOT NULL,
    "rollbackPlanJson" JSONB NOT NULL,
    "leadershipSummary" TEXT NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantProductLifecyclePacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantProductLifecyclePacket_tenantId_status_updatedAt_idx" ON "AssistantProductLifecyclePacket"("tenantId", "status", "updatedAt");
CREATE INDEX "AssistantProductLifecyclePacket_tenantId_lifecycleScore_updatedAt_idx" ON "AssistantProductLifecyclePacket"("tenantId", "lifecycleScore", "updatedAt");

ALTER TABLE "AssistantProductLifecyclePacket" ADD CONSTRAINT "AssistantProductLifecyclePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantProductLifecyclePacket" ADD CONSTRAINT "AssistantProductLifecyclePacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssistantProductLifecyclePacket" ADD CONSTRAINT "AssistantProductLifecyclePacket_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
