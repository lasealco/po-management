-- BF-47 — posted invoice dispute status + credit memo stubs + outbound webhook event kinds.

ALTER TYPE "WmsBillingInvoiceStatus" ADD VALUE 'POST_DISPUTED';

ALTER TYPE "WmsOutboundWebhookEventType" ADD VALUE 'BILLING_INVOICE_POST_DISPUTED';
ALTER TYPE "WmsOutboundWebhookEventType" ADD VALUE 'BILLING_CREDIT_MEMO_STUB_CREATED';

ALTER TABLE "WmsBillingInvoiceRun" ADD COLUMN "postedDisputeOpenedAt" TIMESTAMP(3),
ADD COLUMN "postedDisputeReasonCode" VARCHAR(64),
ADD COLUMN "postedDisputeNote" VARCHAR(800),
ADD COLUMN "postedDisputeOpenedById" TEXT;

ALTER TABLE "WmsBillingInvoiceRun" ADD CONSTRAINT "WmsBillingInvoiceRun_postedDisputeOpenedById_fkey" FOREIGN KEY ("postedDisputeOpenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WmsBillingCreditMemoStub" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceInvoiceRunId" TEXT NOT NULL,
    "creditAmount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "reasonCode" VARCHAR(64) NOT NULL,
    "memoNote" VARCHAR(800),
    "externalArDocumentRef" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "WmsBillingCreditMemoStub_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WmsBillingCreditMemoStub_tenantId_sourceInvoiceRunId_idx" ON "WmsBillingCreditMemoStub"("tenantId", "sourceInvoiceRunId");

ALTER TABLE "WmsBillingCreditMemoStub" ADD CONSTRAINT "WmsBillingCreditMemoStub_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsBillingCreditMemoStub" ADD CONSTRAINT "WmsBillingCreditMemoStub_sourceInvoiceRunId_fkey" FOREIGN KEY ("sourceInvoiceRunId") REFERENCES "WmsBillingInvoiceRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WmsBillingCreditMemoStub" ADD CONSTRAINT "WmsBillingCreditMemoStub_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
