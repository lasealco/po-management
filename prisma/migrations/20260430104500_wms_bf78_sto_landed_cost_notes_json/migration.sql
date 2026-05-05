-- BF-78 — STO landed-cost / FX notes stub (finance narrative JSON on header).

ALTER TABLE "WmsStockTransfer" ADD COLUMN IF NOT EXISTS "landedCostNotesBf78Json" JSONB;
