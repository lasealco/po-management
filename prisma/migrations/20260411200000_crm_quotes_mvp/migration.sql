-- CRM quotes MVP (header + line items)

CREATE TYPE "CrmQuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

CREATE TABLE "CrmQuote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "status" "CrmQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "quoteNumber" TEXT,
    "validUntil" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "subtotal" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmQuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "extendedAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmQuoteLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CrmQuote" ADD CONSTRAINT "CrmQuote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmQuote" ADD CONSTRAINT "CrmQuote_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmQuote" ADD CONSTRAINT "CrmQuote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmQuote" ADD CONSTRAINT "CrmQuote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmQuoteLine" ADD CONSTRAINT "CrmQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CrmQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CrmQuote_tenantId_accountId_idx" ON "CrmQuote"("tenantId", "accountId");
CREATE INDEX "CrmQuote_tenantId_ownerUserId_idx" ON "CrmQuote"("tenantId", "ownerUserId");
CREATE INDEX "CrmQuote_tenantId_status_idx" ON "CrmQuote"("tenantId", "status");
CREATE INDEX "CrmQuoteLine_quoteId_idx" ON "CrmQuoteLine"("quoteId");
