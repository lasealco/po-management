-- BF-65 — damage reports + carrier claim export stub

CREATE TYPE "WmsDamageReportContext" AS ENUM ('RECEIVING', 'PACKING');
CREATE TYPE "WmsDamageReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

CREATE TABLE "WmsDamageReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "context" "WmsDamageReportContext" NOT NULL,
    "status" "WmsDamageReportStatus" NOT NULL DEFAULT 'DRAFT',
    "shipmentId" TEXT,
    "outboundOrderId" TEXT,
    "shipmentItemId" TEXT,
    "damageCategory" VARCHAR(128),
    "description" TEXT,
    "photoUrlsJson" JSONB NOT NULL DEFAULT '[]',
    "extraDetailJson" JSONB,
    "carrierClaimReference" VARCHAR(256),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WmsDamageReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WmsDamageReport_tenantId_createdAt_idx" ON "WmsDamageReport"("tenantId", "createdAt");
CREATE INDEX "WmsDamageReport_shipmentId_idx" ON "WmsDamageReport"("shipmentId");
CREATE INDEX "WmsDamageReport_outboundOrderId_idx" ON "WmsDamageReport"("outboundOrderId");

ALTER TABLE "WmsDamageReport" ADD CONSTRAINT "WmsDamageReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WmsDamageReport" ADD CONSTRAINT "WmsDamageReport_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsDamageReport" ADD CONSTRAINT "WmsDamageReport_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "OutboundOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsDamageReport" ADD CONSTRAINT "WmsDamageReport_shipmentItemId_fkey" FOREIGN KEY ("shipmentItemId") REFERENCES "ShipmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WmsDamageReport" ADD CONSTRAINT "WmsDamageReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
