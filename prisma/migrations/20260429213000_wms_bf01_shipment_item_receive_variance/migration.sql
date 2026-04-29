-- BF-01: line-level receiving variance on ShipmentItem (expected=`quantityShipped`, counted=`quantityReceived`).
CREATE TYPE "WmsShipmentItemVarianceDisposition" AS ENUM ('UNSET', 'MATCH', 'SHORT', 'OVER', 'DAMAGED', 'OTHER');

ALTER TABLE "ShipmentItem" ADD COLUMN "wmsVarianceDisposition" "WmsShipmentItemVarianceDisposition" NOT NULL DEFAULT 'UNSET';
ALTER TABLE "ShipmentItem" ADD COLUMN "wmsVarianceNote" VARCHAR(1000);
