-- BF-89 — product-level carton cap hint + per-unit cube for wave allocation heuristics.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "wmsCartonUnitsBf89" DECIMAL(14, 3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "wmsUnitCubeCm3Bf89" DECIMAL(18, 6);
