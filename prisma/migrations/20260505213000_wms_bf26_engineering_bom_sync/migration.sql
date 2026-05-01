-- BF-26 — CRM engineering BOM on quote lines + WMS work order link / sync metadata.

ALTER TABLE "CrmQuoteLine"
ADD COLUMN "engineeringBomRevision" VARCHAR(128),
ADD COLUMN "engineeringBomLines" JSONB,
ADD COLUMN "engineeringBomMaterialsCents" INTEGER;

ALTER TABLE "WmsWorkOrder"
ADD COLUMN "crmQuoteLineId" TEXT,
ADD COLUMN "engineeringBomSyncedRevision" VARCHAR(128),
ADD COLUMN "engineeringBomSyncedAt" TIMESTAMP(3);

CREATE INDEX "WmsWorkOrder_tenantId_crmQuoteLineId_idx" ON "WmsWorkOrder"("tenantId", "crmQuoteLineId");

ALTER TABLE "WmsWorkOrder"
ADD CONSTRAINT "WmsWorkOrder_crmQuoteLineId_fkey"
FOREIGN KEY ("crmQuoteLineId") REFERENCES "CrmQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
