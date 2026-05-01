-- BF-15 — Greedy min-bin-touches strategy + optional carton/task unit cap on automated waves.
ALTER TYPE "WmsPickAllocationStrategy" ADD VALUE 'GREEDY_MIN_BIN_TOUCHES';

ALTER TABLE "Warehouse" ADD COLUMN "pickWaveCartonUnits" DECIMAL(14,3);
