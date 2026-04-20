-- API hub Phase 1: tenant-scoped connector registry (stub rows; no secrets)

CREATE TABLE "ApiHubConnector" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL DEFAULT 'unspecified',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastSyncAt" TIMESTAMP(3),
    "healthSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiHubConnector_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiHubConnector_tenantId_idx" ON "ApiHubConnector"("tenantId");

CREATE INDEX "ApiHubConnector_tenantId_createdAt_idx" ON "ApiHubConnector"("tenantId", "createdAt");

ALTER TABLE "ApiHubConnector" ADD CONSTRAINT "ApiHubConnector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
