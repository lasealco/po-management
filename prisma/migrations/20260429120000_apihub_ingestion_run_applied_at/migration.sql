-- Slice 28: mark ingestion runs after successful apply (idempotent guard).
ALTER TABLE "ApiHubIngestionRun" ADD COLUMN "appliedAt" TIMESTAMP(3);
