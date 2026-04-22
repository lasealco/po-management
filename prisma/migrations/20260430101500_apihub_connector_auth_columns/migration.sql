-- API Hub: auth metadata columns on connector registry (schema parity; required before index on authMode).

ALTER TABLE "ApiHubConnector" ADD COLUMN "authMode" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "ApiHubConnector" ADD COLUMN "authConfigRef" TEXT;

ALTER TABLE "ApiHubConnector" ADD COLUMN "authState" TEXT NOT NULL DEFAULT 'not_configured';
