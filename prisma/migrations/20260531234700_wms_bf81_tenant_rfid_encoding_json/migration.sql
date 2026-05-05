-- BF-81 — tenant RFID commissioning encoding table for pack/ship scan normalization.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "wmsRfidEncodingTableJsonBf81" JSONB;
