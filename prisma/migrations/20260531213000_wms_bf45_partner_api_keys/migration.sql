-- BF-45 — tenant partner API keys (scoped GET endpoints).

CREATE TYPE "WmsPartnerApiKeyScope" AS ENUM ('INVENTORY_READ', 'OUTBOUND_READ');

CREATE TABLE "WmsPartnerApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "keyPrefix" VARCHAR(24) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "scopes" "WmsPartnerApiKeyScope"[] DEFAULT ARRAY[]::"WmsPartnerApiKeyScope"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "WmsPartnerApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WmsPartnerApiKey_keyHash_key" ON "WmsPartnerApiKey"("keyHash");

CREATE INDEX "WmsPartnerApiKey_tenantId_isActive_idx" ON "WmsPartnerApiKey"("tenantId", "isActive");

ALTER TABLE "WmsPartnerApiKey" ADD CONSTRAINT "WmsPartnerApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
