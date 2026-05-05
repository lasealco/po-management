-- BF-95 — optional scrap / liquidation valuation stub (cents per unit, preview-only).

ALTER TABLE "ShipmentItem" ADD COLUMN "scrapValuePerUnitCentsBf95" INTEGER;

ALTER TABLE "WmsReceivingDispositionTemplate" ADD COLUMN "scrapValuePerUnitCentsBf95" INTEGER;

ALTER TABLE "WmsDamageReport" ADD COLUMN "scrapValuePerUnitCentsBf95" INTEGER;
