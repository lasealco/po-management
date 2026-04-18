-- SRM: compliance reviews, performance scorecards, risk records (supplier 360).

CREATE TYPE "SupplierComplianceReviewOutcome" AS ENUM ('satisfactory', 'action_required', 'failed');
CREATE TYPE "SupplierRiskSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "SupplierRiskStatus" AS ENUM ('open', 'mitigating', 'closed');

CREATE TABLE "SupplierComplianceReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "outcome" "SupplierComplianceReviewOutcome" NOT NULL,
    "summary" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierComplianceReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPerformanceScorecard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodKey" VARCHAR(32) NOT NULL,
    "onTimeDeliveryPct" DECIMAL(5,2),
    "qualityRating" INTEGER,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPerformanceScorecard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierRiskRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "category" VARCHAR(128) NOT NULL,
    "severity" "SupplierRiskSeverity" NOT NULL,
    "status" "SupplierRiskStatus" NOT NULL DEFAULT 'open',
    "details" TEXT,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRiskRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierComplianceReview_tenantId_supplierId_idx" ON "SupplierComplianceReview"("tenantId", "supplierId");
CREATE INDEX "SupplierPerformanceScorecard_tenantId_supplierId_idx" ON "SupplierPerformanceScorecard"("tenantId", "supplierId");
CREATE INDEX "SupplierRiskRecord_tenantId_supplierId_idx" ON "SupplierRiskRecord"("tenantId", "supplierId");

CREATE UNIQUE INDEX "SupplierPerformanceScorecard_supplierId_periodKey_key" ON "SupplierPerformanceScorecard"("supplierId", "periodKey");

ALTER TABLE "SupplierComplianceReview" ADD CONSTRAINT "SupplierComplianceReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierComplianceReview" ADD CONSTRAINT "SupplierComplianceReview_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPerformanceScorecard" ADD CONSTRAINT "SupplierPerformanceScorecard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPerformanceScorecard" ADD CONSTRAINT "SupplierPerformanceScorecard_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierRiskRecord" ADD CONSTRAINT "SupplierRiskRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierRiskRecord" ADD CONSTRAINT "SupplierRiskRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
