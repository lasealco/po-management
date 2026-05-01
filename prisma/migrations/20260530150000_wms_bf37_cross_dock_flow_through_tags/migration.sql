-- BF-37 — cross-dock / flow-through shipment tags + cross-dock staging bins
ALTER TABLE "Shipment" ADD COLUMN "wmsCrossDock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shipment" ADD COLUMN "wmsFlowThrough" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WarehouseBin" ADD COLUMN "isCrossDockStaging" BOOLEAN NOT NULL DEFAULT false;
