-- AMP1: review state for assistant-created sales-order intake.
ALTER TABLE "SalesOrder"
  ADD COLUMN "assistantReviewStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "assistantReviewNote" TEXT,
  ADD COLUMN "assistantReviewedAt" TIMESTAMP(3),
  ADD COLUMN "assistantReviewedById" TEXT;

CREATE INDEX "SalesOrder_tenantId_assistantReviewStatus_updatedAt_idx"
  ON "SalesOrder"("tenantId", "assistantReviewStatus", "updatedAt");

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_assistantReviewedById_fkey"
  FOREIGN KEY ("assistantReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
