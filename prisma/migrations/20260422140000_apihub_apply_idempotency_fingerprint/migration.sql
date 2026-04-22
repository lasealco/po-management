-- AlterTable
ALTER TABLE "ApiHubIngestionApplyIdempotency" ADD COLUMN "requestFingerprint" TEXT NOT NULL DEFAULT 'v1:marker';
