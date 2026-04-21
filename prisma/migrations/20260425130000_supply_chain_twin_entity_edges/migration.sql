-- Supply Chain Twin: directed edges between entity snapshots (tenant-scoped)

CREATE TABLE "SupplyChainTwinEntityEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromSnapshotId" TEXT NOT NULL,
    "toSnapshotId" TEXT NOT NULL,
    "relation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyChainTwinEntityEdge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplyChainTwinEntityEdge_tenantId_idx" ON "SupplyChainTwinEntityEdge"("tenantId");

CREATE INDEX "SupplyChainTwinEntityEdge_tenantId_fromSnapshotId_idx" ON "SupplyChainTwinEntityEdge"("tenantId", "fromSnapshotId");

CREATE INDEX "SupplyChainTwinEntityEdge_tenantId_toSnapshotId_idx" ON "SupplyChainTwinEntityEdge"("tenantId", "toSnapshotId");

ALTER TABLE "SupplyChainTwinEntityEdge" ADD CONSTRAINT "SupplyChainTwinEntityEdge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplyChainTwinEntityEdge" ADD CONSTRAINT "SupplyChainTwinEntityEdge_fromSnapshotId_fkey" FOREIGN KEY ("fromSnapshotId") REFERENCES "SupplyChainTwinEntitySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplyChainTwinEntityEdge" ADD CONSTRAINT "SupplyChainTwinEntityEdge_toSnapshotId_fkey" FOREIGN KEY ("toSnapshotId") REFERENCES "SupplyChainTwinEntitySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
