-- BF-69 — optional CO₂e hints on movements + optional product planning factor (not GLEC-certified).

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "wmsCo2eFactorGramsPerKgKm" DECIMAL(18,6);

ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "co2eEstimateGrams" DECIMAL(18,4);
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "co2eStubJson" JSONB;
