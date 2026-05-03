-- BF-64 — cold-chain custody segment JSON on movements and inbound shipments
ALTER TABLE "InventoryMovement" ADD COLUMN "custodySegmentJson" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "custodySegmentJson" JSONB;
