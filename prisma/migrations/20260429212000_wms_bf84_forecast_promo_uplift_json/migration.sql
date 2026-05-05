-- BF-84 — optional promo uplift multiplier on weekly demand forecast stub (feeds BF-61 gap hints).
ALTER TABLE "WmsDemandForecastStub" ADD COLUMN IF NOT EXISTS "promoUpliftBf84Json" JSONB;
