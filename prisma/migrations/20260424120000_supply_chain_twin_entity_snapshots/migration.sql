-- Supply Chain Twin: tenant-scoped entity snapshots (graph nodes + JSON payload)

CREATE TABLE "SupplyChainTwinEntitySnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityKind" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyChainTwinEntitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyChainTwinEntitySnapshot_tenantId_entityKind_entityKey_key" ON "SupplyChainTwinEntitySnapshot"("tenantId", "entityKind", "entityKey");

CREATE INDEX "SupplyChainTwinEntitySnapshot_tenantId_idx" ON "SupplyChainTwinEntitySnapshot"("tenantId");

CREATE INDEX "SupplyChainTwinEntitySnapshot_tenantId_entityKind_idx" ON "SupplyChainTwinEntitySnapshot"("tenantId", "entityKind");

ALTER TABLE "SupplyChainTwinEntitySnapshot" ADD CONSTRAINT "SupplyChainTwinEntitySnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
