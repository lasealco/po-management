-- Phase 2: optional "order for" org (same tenant)

ALTER TABLE "PurchaseOrder" ADD COLUMN "servedOrgUnitId" TEXT;

ALTER TABLE "SalesOrder" ADD COLUMN "servedOrgUnitId" TEXT;

CREATE INDEX "PurchaseOrder_tenantId_servedOrgUnitId_idx" ON "PurchaseOrder"("tenantId", "servedOrgUnitId");

CREATE INDEX "SalesOrder_tenantId_servedOrgUnitId_idx" ON "SalesOrder"("tenantId", "servedOrgUnitId");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_servedOrgUnitId_fkey" FOREIGN KEY ("servedOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_servedOrgUnitId_fkey" FOREIGN KEY ("servedOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
