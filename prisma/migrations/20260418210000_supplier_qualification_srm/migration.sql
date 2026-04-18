-- SRM: buyer-recorded supplier qualification (master) + optional review timestamp.

CREATE TYPE "SupplierQualificationStatus" AS ENUM (
  'not_started',
  'in_progress',
  'qualified',
  'conditional',
  'disqualified'
);

ALTER TABLE "Supplier"
  ADD COLUMN "qualificationStatus" "SupplierQualificationStatus" NOT NULL DEFAULT 'not_started',
  ADD COLUMN "qualificationSummary" TEXT,
  ADD COLUMN "qualificationLastReviewedAt" TIMESTAMP(3);
