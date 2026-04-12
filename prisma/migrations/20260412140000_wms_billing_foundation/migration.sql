-- WMS Phase B: billing events, rates, invoice runs (orthogonal to inventory truth).

CREATE TYPE "WmsBillingProfileSource" AS ENUM ('MANUAL', 'CRM_ACCOUNT');
CREATE TYPE "WmsBillingInvoiceStatus" AS ENUM ('DRAFT', 'POSTED');

CREATE TABLE "WmsBillingRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "movementType" "InventoryMovementType",
    "amountPerUnit" DECIMAL(14,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsBillingRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsBillingRate_tenantId_code_key" ON "WmsBillingRate"("tenantId", "code");
CREATE INDEX "WmsBillingRate_tenantId_isActive_idx" ON "WmsBillingRate"("tenantId", "isActive");
ALTER TABLE "WmsBillingRate" ADD CONSTRAINT "WmsBillingRate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WmsBillingInvoiceRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runNo" TEXT NOT NULL,
    "profileSource" "WmsBillingProfileSource" NOT NULL DEFAULT 'MANUAL',
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "status" "WmsBillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "csvSnapshot" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsBillingInvoiceRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsBillingInvoiceRun_tenantId_runNo_key" ON "WmsBillingInvoiceRun"("tenantId", "runNo");
CREATE INDEX "WmsBillingInvoiceRun_tenantId_createdAt_idx" ON "WmsBillingInvoiceRun"("tenantId", "createdAt");
ALTER TABLE "WmsBillingInvoiceRun" ADD CONSTRAINT "WmsBillingInvoiceRun_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsBillingInvoiceRun" ADD CONSTRAINT "WmsBillingInvoiceRun_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WmsBillingInvoiceLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceRunId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitAmount" DECIMAL(14,4) NOT NULL,
    "lineAmount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "WmsBillingInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsBillingInvoiceLine_invoiceRunId_lineNo_key" ON "WmsBillingInvoiceLine"("invoiceRunId", "lineNo");
CREATE INDEX "WmsBillingInvoiceLine_tenantId_invoiceRunId_idx" ON "WmsBillingInvoiceLine"("tenantId", "invoiceRunId");
ALTER TABLE "WmsBillingInvoiceLine" ADD CONSTRAINT "WmsBillingInvoiceLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsBillingInvoiceLine" ADD CONSTRAINT "WmsBillingInvoiceLine_invoiceRunId_fkey"
  FOREIGN KEY ("invoiceRunId") REFERENCES "WmsBillingInvoiceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WmsBillingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileSource" "WmsBillingProfileSource" NOT NULL DEFAULT 'MANUAL',
    "inventoryMovementId" TEXT,
    "movementType" "InventoryMovementType" NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rateCode" TEXT NOT NULL,
    "unitRate" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "invoiceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WmsBillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsBillingEvent_inventoryMovementId_key" ON "WmsBillingEvent"("inventoryMovementId");
CREATE INDEX "WmsBillingEvent_tenantId_occurredAt_idx" ON "WmsBillingEvent"("tenantId", "occurredAt");
CREATE INDEX "WmsBillingEvent_tenantId_invoiceRunId_idx" ON "WmsBillingEvent"("tenantId", "invoiceRunId");
ALTER TABLE "WmsBillingEvent" ADD CONSTRAINT "WmsBillingEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsBillingEvent" ADD CONSTRAINT "WmsBillingEvent_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsBillingEvent" ADD CONSTRAINT "WmsBillingEvent_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsBillingEvent" ADD CONSTRAINT "WmsBillingEvent_inventoryMovementId_fkey"
  FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsBillingEvent" ADD CONSTRAINT "WmsBillingEvent_invoiceRunId_fkey"
  FOREIGN KEY ("invoiceRunId") REFERENCES "WmsBillingInvoiceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
