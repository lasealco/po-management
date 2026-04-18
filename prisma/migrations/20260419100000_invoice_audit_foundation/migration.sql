-- Invoice audit foundation: intakes, parsed lines, tolerance rules, per-line audit vs pricing snapshots

CREATE TYPE "InvoiceIntakeStatus" AS ENUM ('DRAFT', 'RECEIVED', 'PARSED', 'AUDITED', 'FAILED');
CREATE TYPE "InvoiceAuditRollupOutcome" AS ENUM ('NONE', 'PENDING', 'PASS', 'WARN', 'FAIL');
CREATE TYPE "InvoiceAuditLineOutcome" AS ENUM ('GREEN', 'AMBER', 'RED', 'UNKNOWN');
CREATE TYPE "InvoiceReviewDecision" AS ENUM ('NONE', 'APPROVED', 'OVERRIDDEN');

CREATE TABLE "tolerance_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "amountAbsTolerance" DECIMAL(18,4),
    "percentTolerance" DECIMAL(9,6),
    "currencyScope" VARCHAR(3),
    "categoryScope" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tolerance_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_intakes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "InvoiceIntakeStatus" NOT NULL DEFAULT 'RECEIVED',
    "bookingPricingSnapshotId" TEXT NOT NULL,
    "externalInvoiceNo" VARCHAR(128),
    "vendorLabel" VARCHAR(256),
    "invoiceDate" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "rawSourceNotes" TEXT,
    "parseError" TEXT,
    "parseWarnings" JSONB,
    "auditRunError" TEXT,
    "lastAuditAt" TIMESTAMP(3),
    "rollupOutcome" "InvoiceAuditRollupOutcome" NOT NULL DEFAULT 'NONE',
    "greenLineCount" INTEGER NOT NULL DEFAULT 0,
    "amberLineCount" INTEGER NOT NULL DEFAULT 0,
    "redLineCount" INTEGER NOT NULL DEFAULT 0,
    "unknownLineCount" INTEGER NOT NULL DEFAULT 0,
    "reviewDecision" "InvoiceReviewDecision" NOT NULL DEFAULT 'NONE',
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_intakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceIntakeId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "rawDescription" TEXT NOT NULL,
    "normalizedLabel" VARCHAR(512),
    "currency" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "unitBasis" VARCHAR(64),
    "quantity" DECIMAL(18,6),
    "sourceRowJson" JSONB,
    "parseConfidence" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_results" (
    "id" TEXT NOT NULL,
    "invoiceIntakeId" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "bookingPricingSnapshotId" TEXT NOT NULL,
    "toleranceRuleId" TEXT,
    "outcome" "InvoiceAuditLineOutcome" NOT NULL,
    "discrepancyCategories" JSONB NOT NULL,
    "expectedAmount" DECIMAL(18,4),
    "amountVariance" DECIMAL(18,4),
    "percentVariance" DECIMAL(9,6),
    "snapshotMatchedJson" JSONB,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_results_invoiceLineId_key" ON "audit_results"("invoiceLineId");

CREATE UNIQUE INDEX "invoice_lines_invoiceIntakeId_lineNo_key" ON "invoice_lines"("invoiceIntakeId", "lineNo");

CREATE INDEX "tolerance_rules_tenantId_active_priority_idx" ON "tolerance_rules"("tenantId", "active", "priority");

CREATE INDEX "invoice_intakes_tenantId_idx" ON "invoice_intakes"("tenantId");
CREATE INDEX "invoice_intakes_tenantId_receivedAt_idx" ON "invoice_intakes"("tenantId", "receivedAt");
CREATE INDEX "invoice_intakes_bookingPricingSnapshotId_idx" ON "invoice_intakes"("bookingPricingSnapshotId");

CREATE INDEX "invoice_lines_invoiceIntakeId_idx" ON "invoice_lines"("invoiceIntakeId");

CREATE INDEX "audit_results_invoiceIntakeId_idx" ON "audit_results"("invoiceIntakeId");
CREATE INDEX "audit_results_bookingPricingSnapshotId_idx" ON "audit_results"("bookingPricingSnapshotId");

ALTER TABLE "tolerance_rules" ADD CONSTRAINT "tolerance_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_intakes" ADD CONSTRAINT "invoice_intakes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_intakes" ADD CONSTRAINT "invoice_intakes_bookingPricingSnapshotId_fkey" FOREIGN KEY ("bookingPricingSnapshotId") REFERENCES "booking_pricing_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_intakes" ADD CONSTRAINT "invoice_intakes_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_intakes" ADD CONSTRAINT "invoice_intakes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceIntakeId_fkey" FOREIGN KEY ("invoiceIntakeId") REFERENCES "invoice_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_invoiceIntakeId_fkey" FOREIGN KEY ("invoiceIntakeId") REFERENCES "invoice_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "invoice_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_bookingPricingSnapshotId_fkey" FOREIGN KEY ("bookingPricingSnapshotId") REFERENCES "booking_pricing_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_toleranceRuleId_fkey" FOREIGN KEY ("toleranceRuleId") REFERENCES "tolerance_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
