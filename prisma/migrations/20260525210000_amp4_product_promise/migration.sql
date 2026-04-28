-- AMP4: durable product availability-to-promise review and recovery proposal.
ALTER TABLE "Product"
  ADD COLUMN "assistantPromiseStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "assistantPromiseSummary" TEXT,
  ADD COLUMN "assistantRecoveryProposal" TEXT,
  ADD COLUMN "assistantPromiseReviewedAt" TIMESTAMP(3);

CREATE INDEX "Product_tenantId_assistantPromiseStatus_updatedAt_idx"
  ON "Product"("tenantId", "assistantPromiseStatus", "updatedAt");
