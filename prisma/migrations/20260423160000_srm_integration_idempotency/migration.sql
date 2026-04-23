-- SRM Phase E: idempotency rows for integration POSTs (slice 25).
-- Rollback: DROP TABLE "SrmIntegrationIdempotency";

CREATE TABLE "SrmIntegrationIdempotency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "surface" VARCHAR(64) NOT NULL,
    "key" VARCHAR(256) NOT NULL,
    "bodySha256" VARCHAR(64) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SrmIntegrationIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SrmIntegrationIdempotency_tenantId_surface_key_key" ON "SrmIntegrationIdempotency"("tenantId", "surface", "key");

CREATE INDEX "SrmIntegrationIdempotency_tenantId_createdAt_idx" ON "SrmIntegrationIdempotency"("tenantId", "createdAt");

ALTER TABLE "SrmIntegrationIdempotency" ADD CONSTRAINT "SrmIntegrationIdempotency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
