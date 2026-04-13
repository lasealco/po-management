-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "asnReference" TEXT,
ADD COLUMN "expectedReceiveAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WmsBillingEvent" ADD COLUMN "crmAccountId" TEXT;

-- CreateIndex
CREATE INDEX "WmsBillingEvent_tenantId_crmAccountId_idx" ON "WmsBillingEvent"("tenantId", "crmAccountId");

-- AddForeignKey
ALTER TABLE "WmsBillingEvent" ADD CONSTRAINT "WmsBillingEvent_crmAccountId_fkey" FOREIGN KEY ("crmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
