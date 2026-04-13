-- AlterTable
ALTER TABLE "OutboundOrder" ADD COLUMN "crmAccountId" TEXT;

-- CreateIndex
CREATE INDEX "OutboundOrder_tenantId_crmAccountId_idx" ON "OutboundOrder"("tenantId", "crmAccountId");

-- AddForeignKey
ALTER TABLE "OutboundOrder" ADD CONSTRAINT "OutboundOrder_crmAccountId_fkey" FOREIGN KEY ("crmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
