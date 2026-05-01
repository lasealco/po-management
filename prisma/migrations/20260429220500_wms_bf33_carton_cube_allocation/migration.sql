-- BF-33 — Carton dims on Product, soft bin cube hint, outbound cube estimate, cube-aware greedy strategies.

ALTER TABLE "Product"
ADD COLUMN "cartonLengthMm" INTEGER,
ADD COLUMN "cartonWidthMm" INTEGER,
ADD COLUMN "cartonHeightMm" INTEGER,
ADD COLUMN "cartonUnitsPerMasterCarton" DECIMAL(14, 3);

ALTER TABLE "WarehouseBin"
ADD COLUMN "capacityCubeCubicMm" INTEGER;

ALTER TABLE "OutboundOrder"
ADD COLUMN "estimatedCubeCbm" DECIMAL(12, 6);

ALTER TYPE "WmsPickAllocationStrategy" ADD VALUE 'GREEDY_MIN_BIN_TOUCHES_CUBE_AWARE';
ALTER TYPE "WmsPickAllocationStrategy" ADD VALUE 'GREEDY_RESERVE_PICK_FACE_CUBE_AWARE';
