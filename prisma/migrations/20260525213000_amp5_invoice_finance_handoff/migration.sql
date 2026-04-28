-- AMP5: durable finance handoff packet for invoice audit against frozen pricing snapshots.
ALTER TABLE "invoice_intakes"
  ADD COLUMN "financeHandoffStatus" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "financeHandoffSummary" TEXT,
  ADD COLUMN "disputeDraft" TEXT,
  ADD COLUMN "accountingPacketJson" JSONB,
  ADD COLUMN "financeHandoffUpdatedAt" TIMESTAMP(3);

CREATE INDEX "invoice_intakes_tenantId_financeHandoffStatus_updatedAt_idx"
  ON "invoice_intakes"("tenantId", "financeHandoffStatus", "updatedAt");
