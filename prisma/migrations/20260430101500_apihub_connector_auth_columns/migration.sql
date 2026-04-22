-- API Hub: auth metadata columns on connector registry (schema parity; required before index on authMode).
-- IF NOT EXISTS: some environments (e.g. Neon) may already have these columns from an out-of-band sync.

ALTER TABLE "ApiHubConnector" ADD COLUMN IF NOT EXISTS "authMode" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "ApiHubConnector" ADD COLUMN IF NOT EXISTS "authConfigRef" TEXT;

ALTER TABLE "ApiHubConnector" ADD COLUMN IF NOT EXISTS "authState" TEXT NOT NULL DEFAULT 'not_configured';
