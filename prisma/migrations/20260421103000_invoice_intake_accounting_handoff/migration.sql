-- Phase 06: explicit accounting handoff flag + note after finance review (audit trail).

ALTER TABLE "invoice_intakes"
ADD COLUMN "approvedForAccounting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "accountingApprovedAt" TIMESTAMP(3),
ADD COLUMN "accountingApprovedByUserId" TEXT,
ADD COLUMN "accountingApprovalNote" TEXT;

ALTER TABLE "invoice_intakes"
ADD CONSTRAINT "invoice_intakes_accountingApprovedByUserId_fkey"
FOREIGN KEY ("accountingApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
