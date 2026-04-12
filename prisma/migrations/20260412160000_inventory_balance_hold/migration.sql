-- Minimal QC: block picks from held stock while keeping ledger elsewhere unchanged.

ALTER TABLE "InventoryBalance" ADD COLUMN "onHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryBalance" ADD COLUMN "holdReason" VARCHAR(500);
