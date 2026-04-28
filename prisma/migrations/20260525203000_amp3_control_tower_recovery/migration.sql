-- AMP3: durable Control Tower recovery state and communication drafts on exceptions.
ALTER TABLE "CtException"
  ADD COLUMN "customerImpact" TEXT,
  ADD COLUMN "recoveryState" VARCHAR(32) NOT NULL DEFAULT 'TRIAGE',
  ADD COLUMN "recoveryPlan" TEXT,
  ADD COLUMN "carrierDraft" TEXT,
  ADD COLUMN "customerDraft" TEXT,
  ADD COLUMN "playbookSteps" JSONB,
  ADD COLUMN "recoveryUpdatedAt" TIMESTAMP(3);

CREATE INDEX "CtException_tenantId_recoveryState_updatedAt_idx"
  ON "CtException"("tenantId", "recoveryState", "updatedAt");
