-- API Hub: ingestion run provenance for list filters (Slice 22).

ALTER TABLE "ApiHubIngestionRun" ADD COLUMN "triggerKind" TEXT NOT NULL DEFAULT 'api';
