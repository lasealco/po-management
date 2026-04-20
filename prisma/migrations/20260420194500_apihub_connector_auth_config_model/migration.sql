-- API hub M1: connector auth/config metadata model (no secrets).

ALTER TABLE "ApiHubConnector"
  ADD COLUMN "authMode" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "authConfigRef" TEXT,
  ADD COLUMN "authState" TEXT NOT NULL DEFAULT 'not_configured';
