-- Phase 5: align PO with Shipment / SalesOrder for 3PL customer (CRM) dimension
ALTER TABLE "PurchaseOrder" ADD COLUMN "customerCrmAccountId" TEXT;

CREATE INDEX "PurchaseOrder_tenantId_customerCrmAccountId_idx" ON "PurchaseOrder"("tenantId", "customerCrmAccountId");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_customerCrmAccountId_fkey" FOREIGN KEY ("customerCrmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
