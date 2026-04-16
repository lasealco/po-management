-- Forwarder-oriented cargo fields (manual / future integration); CargoWise mapping comes later.

ALTER TABLE "Shipment"
ADD COLUMN "cargoOuterPackageCount" INTEGER,
ADD COLUMN "cargoChargeableWeightKg" DECIMAL(12,3),
ADD COLUMN "cargoDimensionsText" VARCHAR(512),
ADD COLUMN "cargoCommoditySummary" TEXT;

ALTER TABLE "ShipmentItem"
ADD COLUMN "cargoPackageCount" INTEGER,
ADD COLUMN "cargoGrossWeightKg" DECIMAL(14,3),
ADD COLUMN "cargoVolumeCbm" DECIMAL(12,6),
ADD COLUMN "cargoDimensionsText" VARCHAR(512);
