-- AlterTable
ALTER TABLE "OutboundOrder" ADD COLUMN "sourceCrmQuoteId" TEXT;

-- CreateIndex
CREATE INDEX "OutboundOrder_tenantId_sourceCrmQuoteId_idx" ON "OutboundOrder"("tenantId", "sourceCrmQuoteId");

-- AddForeignKey
ALTER TABLE "OutboundOrder" ADD CONSTRAINT "OutboundOrder_sourceCrmQuoteId_fkey" FOREIGN KEY ("sourceCrmQuoteId") REFERENCES "CrmQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
