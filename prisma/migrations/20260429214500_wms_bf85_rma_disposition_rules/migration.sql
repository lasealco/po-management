-- BF-85 — tenant RMA disposition rules for CUSTOMER_RETURN bulk apply
CREATE TYPE "WmsRmaDispositionMatchFieldBf85" AS ENUM (
  'ORDER_LINE_DESCRIPTION',
  'PRODUCT_SKU',
  'PRODUCT_CODE',
  'SHIPMENT_RMA_REFERENCE'
);

CREATE TYPE "WmsRmaDispositionMatchModeBf85" AS ENUM ('EXACT', 'PREFIX', 'CONTAINS');

CREATE TABLE "WmsRmaDispositionRuleBf85" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchField" "WmsRmaDispositionMatchFieldBf85" NOT NULL,
    "matchMode" "WmsRmaDispositionMatchModeBf85" NOT NULL DEFAULT 'CONTAINS',
    "pattern" VARCHAR(256) NOT NULL,
    "applyDisposition" "WmsReturnLineDisposition" NOT NULL,
    "receivingDispositionTemplateId" TEXT,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsRmaDispositionRuleBf85_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WmsRmaDispositionRuleBf85_tenantId_priority_idx" ON "WmsRmaDispositionRuleBf85" ("tenantId", "priority");

ALTER TABLE "WmsRmaDispositionRuleBf85"
ADD CONSTRAINT "WmsRmaDispositionRuleBf85_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WmsRmaDispositionRuleBf85"
ADD CONSTRAINT "WmsRmaDispositionRuleBf85_receivingDispositionTemplateId_fkey"
FOREIGN KEY ("receivingDispositionTemplateId") REFERENCES "WmsReceivingDispositionTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
