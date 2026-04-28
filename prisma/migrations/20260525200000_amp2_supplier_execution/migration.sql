-- AMP2: durable supplier execution assistant brief, onboarding gap plan, and review status.
ALTER TABLE "Supplier"
  ADD COLUMN "assistantPerformanceBrief" TEXT,
  ADD COLUMN "assistantOnboardingGapPlan" TEXT,
  ADD COLUMN "assistantExecutionStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "assistantExecutionNote" TEXT,
  ADD COLUMN "assistantLastReviewedAt" TIMESTAMP(3);

CREATE INDEX "Supplier_tenantId_assistantExecutionStatus_updatedAt_idx"
  ON "Supplier"("tenantId", "assistantExecutionStatus", "updatedAt");
