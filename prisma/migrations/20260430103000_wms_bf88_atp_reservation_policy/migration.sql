-- BF-88 — tenant ATP soft-reservation tier policy + reservation priority for pick allocation ATP.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "wmsAtpReservationPolicyJsonBf88" JSONB;

ALTER TABLE "WmsInventorySoftReservation" ADD COLUMN IF NOT EXISTS "priorityBf88" INTEGER NOT NULL DEFAULT 100;
