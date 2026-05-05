-- BF-97 — Scope 3 upstream CO₂e stub (grams per kg); optional movement rollup hint.

ALTER TABLE "Supplier"
ADD COLUMN IF NOT EXISTS "wmsScope3UpstreamCo2eGramsPerKgBf97" DECIMAL(18,6);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "wmsScope3UpstreamCo2eGramsPerKgBf97" DECIMAL(18,6);

ALTER TABLE "InventoryMovement"
ADD COLUMN IF NOT EXISTS "co2eScope3UpstreamHintGramsBf97" DECIMAL(18,4);
