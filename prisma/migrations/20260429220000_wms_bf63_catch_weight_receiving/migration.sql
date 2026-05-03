-- BF-63 — catch-weight receiving (variable net weight vs declared kg on line)
ALTER TABLE "Product" ADD COLUMN "isCatchWeight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "catchWeightLabelHint" VARCHAR(256);

ALTER TABLE "Shipment" ADD COLUMN "catchWeightTolerancePct" DECIMAL(5, 2);

ALTER TABLE "ShipmentItem" ADD COLUMN "catchWeightKg" DECIMAL(14, 3);
