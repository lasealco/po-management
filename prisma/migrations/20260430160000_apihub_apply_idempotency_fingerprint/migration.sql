-- AlterTable: apply idempotency fingerprint (Slice requestFingerprint).
-- IF NOT EXISTS: Neon / preview DBs may already have the column from an out-of-band sync.

ALTER TABLE "ApiHubIngestionApplyIdempotency" ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT NOT NULL DEFAULT 'v1:marker';
