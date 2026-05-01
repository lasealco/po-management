-- BF-32 — receiving accrual / GRNI staging snapshot per closed dock receipt (finance export hook)

CREATE TABLE "WmsReceivingAccrualStaging" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wmsReceiptId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "crmAccountId" TEXT,
    "warehouseId" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsReceivingAccrualStaging_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsReceivingAccrualStaging_wmsReceiptId_key" ON "WmsReceivingAccrualStaging"("wmsReceiptId");

CREATE INDEX "WmsReceivingAccrualStaging_tenantId_createdAt_idx" ON "WmsReceivingAccrualStaging"("tenantId", "createdAt");

CREATE INDEX "WmsReceivingAccrualStaging_tenantId_shipmentId_idx" ON "WmsReceivingAccrualStaging"("tenantId", "shipmentId");

ALTER TABLE "WmsReceivingAccrualStaging" ADD CONSTRAINT "WmsReceivingAccrualStaging_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsReceivingAccrualStaging" ADD CONSTRAINT "WmsReceivingAccrualStaging_wmsReceiptId_fkey" FOREIGN KEY ("wmsReceiptId") REFERENCES "WmsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsReceivingAccrualStaging" ADD CONSTRAINT "WmsReceivingAccrualStaging_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsReceivingAccrualStaging" ADD CONSTRAINT "WmsReceivingAccrualStaging_crmAccountId_fkey" FOREIGN KEY ("crmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WmsReceivingAccrualStaging" ADD CONSTRAINT "WmsReceivingAccrualStaging_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
