-- AMP1: durable sales-order assistant intake details and line items.
ALTER TABLE "SalesOrder"
  ADD COLUMN "assistantSourceText" TEXT,
  ADD COLUMN "assistantSourceSnapshot" JSONB,
  ADD COLUMN "assistantDraftReply" TEXT;

CREATE TABLE "SalesOrderLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "productId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitPrice" DECIMAL(14,4) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "source" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesOrderLine_salesOrderId_lineNo_key" ON "SalesOrderLine"("salesOrderId", "lineNo");
CREATE INDEX "SalesOrderLine_tenantId_salesOrderId_idx" ON "SalesOrderLine"("tenantId", "salesOrderId");
CREATE INDEX "SalesOrderLine_tenantId_productId_idx" ON "SalesOrderLine"("tenantId", "productId");

ALTER TABLE "SalesOrderLine"
  ADD CONSTRAINT "SalesOrderLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderLine"
  ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderLine"
  ADD CONSTRAINT "SalesOrderLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
