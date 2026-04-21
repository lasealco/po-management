-- API Hub apply idempotency (Slice 42): deterministic replays for POST .../apply
CREATE TABLE "ApiHubIngestionApplyIdempotency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "ingestionRunId" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiHubIngestionApplyIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiHubIngestionApplyIdempotency_tenantId_idempotencyKey_key" ON "ApiHubIngestionApplyIdempotency"("tenantId", "idempotencyKey");

CREATE INDEX "ApiHubIngestionApplyIdempotency_tenantId_ingestionRunId_idx" ON "ApiHubIngestionApplyIdempotency"("tenantId", "ingestionRunId");

ALTER TABLE "ApiHubIngestionApplyIdempotency" ADD CONSTRAINT "ApiHubIngestionApplyIdempotency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
