-- Optional structured addressing for pallet racking / pick shelves (see docs/wms/GAP_MAP.md).
ALTER TABLE "WarehouseBin"
ADD COLUMN "rackCode" VARCHAR(64),
ADD COLUMN "aisle" VARCHAR(32),
ADD COLUMN "bay" VARCHAR(32),
ADD COLUMN "level" INTEGER,
ADD COLUMN "positionIndex" INTEGER;

CREATE INDEX "WarehouseBin_warehouseId_rackCode_idx" ON "WarehouseBin" ("warehouseId", "rackCode");
