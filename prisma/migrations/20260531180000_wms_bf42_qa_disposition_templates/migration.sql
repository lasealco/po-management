-- BF-42 — receiving disposition note templates + optional QA sampling hints on shipment lines
CREATE TABLE "WmsReceivingDispositionTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "noteTemplate" VARCHAR(2000) NOT NULL,
    "suggestedVarianceDisposition" "WmsShipmentItemVarianceDisposition",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsReceivingDispositionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsReceivingDispositionTemplate_tenantId_code_key" ON "WmsReceivingDispositionTemplate"("tenantId", "code");
CREATE INDEX "WmsReceivingDispositionTemplate_tenantId_idx" ON "WmsReceivingDispositionTemplate"("tenantId");

ALTER TABLE "WmsReceivingDispositionTemplate" ADD CONSTRAINT "WmsReceivingDispositionTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShipmentItem" ADD COLUMN "wmsQaSamplingSkipLot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShipmentItem" ADD COLUMN "wmsQaSamplingPct" DECIMAL(5,2);
ALTER TABLE "ShipmentItem" ADD COLUMN "wmsReceivingDispositionTemplateId" TEXT;

ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_wmsReceivingDispositionTemplateId_fkey" FOREIGN KEY ("wmsReceivingDispositionTemplateId") REFERENCES "WmsReceivingDispositionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ShipmentItem_wmsReceivingDispositionTemplateId_idx" ON "ShipmentItem"("wmsReceivingDispositionTemplateId");
