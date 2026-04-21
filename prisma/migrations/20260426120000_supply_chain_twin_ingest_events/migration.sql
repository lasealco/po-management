-- Supply Chain Twin: append-only ingest events (twin saw X). Max payload size is enforced in app writers, not DB.

CREATE TABLE "SupplyChainTwinIngestEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyChainTwinIngestEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyChainTwinIngestEvent_tenantId_idx" ON "SupplyChainTwinIngestEvent"("tenantId");

CREATE INDEX "SupplyChainTwinIngestEvent_tenantId_createdAt_idx" ON "SupplyChainTwinIngestEvent"("tenantId", "createdAt");

CREATE INDEX "SupplyChainTwinIngestEvent_tenantId_type_createdAt_idx" ON "SupplyChainTwinIngestEvent"("tenantId", "type", "createdAt");

ALTER TABLE "SupplyChainTwinIngestEvent" ADD CONSTRAINT "SupplyChainTwinIngestEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
