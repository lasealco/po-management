-- API Hub M2: ingestion run pipeline core with retries and idempotency.

CREATE TABLE "ApiHubIngestionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "resultSummary" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "retryOfRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiHubIngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiHubIngestionRun_tenantId_idempotencyKey_key"
ON "ApiHubIngestionRun"("tenantId", "idempotencyKey");

CREATE INDEX "ApiHubIngestionRun_tenantId_createdAt_idx"
ON "ApiHubIngestionRun"("tenantId", "createdAt");

CREATE INDEX "ApiHubIngestionRun_tenantId_status_createdAt_idx"
ON "ApiHubIngestionRun"("tenantId", "status", "createdAt");

CREATE INDEX "ApiHubIngestionRun_connectorId_createdAt_idx"
ON "ApiHubIngestionRun"("connectorId", "createdAt");

CREATE INDEX "ApiHubIngestionRun_requestedByUserId_createdAt_idx"
ON "ApiHubIngestionRun"("requestedByUserId", "createdAt");

CREATE INDEX "ApiHubIngestionRun_retryOfRunId_createdAt_idx"
ON "ApiHubIngestionRun"("retryOfRunId", "createdAt");

ALTER TABLE "ApiHubIngestionRun"
  ADD CONSTRAINT "ApiHubIngestionRun_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApiHubIngestionRun"
  ADD CONSTRAINT "ApiHubIngestionRun_connectorId_fkey"
  FOREIGN KEY ("connectorId") REFERENCES "ApiHubConnector"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApiHubIngestionRun"
  ADD CONSTRAINT "ApiHubIngestionRun_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApiHubIngestionRun"
  ADD CONSTRAINT "ApiHubIngestionRun_retryOfRunId_fkey"
  FOREIGN KEY ("retryOfRunId") REFERENCES "ApiHubIngestionRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
