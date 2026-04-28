-- AMP16: governed transportation procurement plans for RFQ, snapshot, execution, and invoice feedback loops.
CREATE TABLE "transportation_procurement_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "quoteRequestId" TEXT,
    "title" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "recommendedCarrier" VARCHAR(256),
    "recommendedSupplierId" TEXT,
    "recommendedResponseId" TEXT,
    "recommendedSnapshotId" TEXT,
    "allocationScore" INTEGER NOT NULL DEFAULT 0,
    "carrierScorecardJson" JSONB NOT NULL,
    "rfqEvidenceJson" JSONB NOT NULL,
    "snapshotEvidenceJson" JSONB NOT NULL,
    "invoiceFeedbackJson" JSONB NOT NULL,
    "allocationPlanJson" JSONB NOT NULL,
    "tenderDraftJson" JSONB NOT NULL,
    "actionQueueItemId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transportation_procurement_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transportation_procurement_plans_tenantId_status_updatedAt_idx" ON "transportation_procurement_plans"("tenantId", "status", "updatedAt");
CREATE INDEX "transportation_procurement_plans_tenantId_quoteRequestId_idx" ON "transportation_procurement_plans"("tenantId", "quoteRequestId");

ALTER TABLE "transportation_procurement_plans"
    ADD CONSTRAINT "transportation_procurement_plans_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transportation_procurement_plans"
    ADD CONSTRAINT "transportation_procurement_plans_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transportation_procurement_plans"
    ADD CONSTRAINT "transportation_procurement_plans_quoteRequestId_fkey"
    FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
