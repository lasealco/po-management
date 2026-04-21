-- Supply Chain Twin: tenant-scoped scenario draft rows (Slice 24)

CREATE TABLE "SupplyChainTwinScenarioDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "draftJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyChainTwinScenarioDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyChainTwinScenarioDraft_tenantId_idx" ON "SupplyChainTwinScenarioDraft"("tenantId");

CREATE INDEX "SupplyChainTwinScenarioDraft_tenantId_updatedAt_idx" ON "SupplyChainTwinScenarioDraft"("tenantId", "updatedAt");

ALTER TABLE "SupplyChainTwinScenarioDraft" ADD CONSTRAINT "SupplyChainTwinScenarioDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
