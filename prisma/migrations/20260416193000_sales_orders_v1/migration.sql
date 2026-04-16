-- Sales Orders v1 (export/ad-hoc bridge) and shipment link.

CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "soNumber" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerName" TEXT NOT NULL,
    "customerCrmAccountId" TEXT,
    "externalRef" TEXT,
    "requestedShipDate" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Shipment" ADD COLUMN "salesOrderId" TEXT;

CREATE UNIQUE INDEX "SalesOrder_tenantId_soNumber_key" ON "SalesOrder"("tenantId", "soNumber");
CREATE INDEX "SalesOrder_tenantId_status_createdAt_idx" ON "SalesOrder"("tenantId", "status", "createdAt");
CREATE INDEX "SalesOrder_customerCrmAccountId_idx" ON "SalesOrder"("customerCrmAccountId");
CREATE INDEX "Shipment_salesOrderId_idx" ON "Shipment"("salesOrderId");

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerCrmAccountId_fkey" FOREIGN KEY ("customerCrmAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
