-- BF-41 — customer returns / RMA inbound subtype + line disposition + optional outbound lineage
CREATE TYPE "WmsInboundSubtype" AS ENUM ('STANDARD', 'CUSTOMER_RETURN');
CREATE TYPE "WmsReturnLineDisposition" AS ENUM ('RESTOCK', 'SCRAP', 'QUARANTINE');

ALTER TABLE "Shipment" ADD COLUMN "wmsInboundSubtype" "WmsInboundSubtype" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Shipment" ADD COLUMN "wmsRmaReference" VARCHAR(128);
ALTER TABLE "Shipment" ADD COLUMN "returnSourceOutboundOrderId" TEXT;

ALTER TABLE "ShipmentItem" ADD COLUMN "wmsReturnDisposition" "WmsReturnLineDisposition";

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_returnSourceOutboundOrderId_fkey" FOREIGN KEY ("returnSourceOutboundOrderId") REFERENCES "OutboundOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Shipment_returnSourceOutboundOrderId_idx" ON "Shipment"("returnSourceOutboundOrderId");
