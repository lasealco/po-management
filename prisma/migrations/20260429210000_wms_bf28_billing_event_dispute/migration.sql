-- BF-28: dispute flags on billing events (exclude from invoice runs until cleared)

ALTER TABLE "WmsBillingEvent" ADD COLUMN "billingDisputed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WmsBillingEvent" ADD COLUMN "billingDisputeNote" VARCHAR(800);

CREATE INDEX "WmsBillingEvent_tenantId_invoiceRunId_billingDisputed_idx"
  ON "WmsBillingEvent" ("tenantId", "invoiceRunId", "billingDisputed");
