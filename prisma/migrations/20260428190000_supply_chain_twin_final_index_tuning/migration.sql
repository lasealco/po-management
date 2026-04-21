-- Slice 214 — Final Twin index tuning pass (Twin-only tables).
--
-- Each index below maps directly to an observed query pattern in `src/lib/supply-chain-twin/**`.

-- Query pattern: `listEdgesForTenant` / `/api/supply-chain-twin/edges`
-- `WHERE tenantId = ?` then `ORDER BY updatedAt DESC, id DESC` for newest-first edge pages.
CREATE INDEX "SupplyChainTwinEntityEdge_tenantId_updatedAt_id_idx"
ON "SupplyChainTwinEntityEdge"("tenantId", "updatedAt", "id");

-- Query pattern: `listEdgesForEntity` direction=`out` and `listEntityNeighborsForTenant` direction=`out`
-- `WHERE tenantId = ? AND fromSnapshotId = ?` with the same newest-first ordering.
CREATE INDEX "SupplyChainTwinEntityEdge_tenantId_fromSnapshotId_updatedAt_id_idx"
ON "SupplyChainTwinEntityEdge"("tenantId", "fromSnapshotId", "updatedAt", "id");

-- Query pattern: `listEdgesForEntity` direction=`in` and `listEntityNeighborsForTenant` direction=`in`
-- `WHERE tenantId = ? AND toSnapshotId = ?` with newest-first ordering.
CREATE INDEX "SupplyChainTwinEntityEdge_tenantId_toSnapshotId_updatedAt_id_idx"
ON "SupplyChainTwinEntityEdge"("tenantId", "toSnapshotId", "updatedAt", "id");

-- Query pattern: `listRiskSignalsForTenantPage` when severity filter is present
-- `WHERE tenantId = ? AND severity = ?` with keyset sort `ORDER BY createdAt DESC, id DESC`.
CREATE INDEX "SupplyChainTwinRiskSignal_tenantId_severity_createdAt_id_idx"
ON "SupplyChainTwinRiskSignal"("tenantId", "severity", "createdAt", "id");

-- Query pattern: `/api/supply-chain-twin/events` default list path (no type filter)
-- `WHERE tenantId = ?` (+ optional createdAt window) with keyset sort `ORDER BY createdAt DESC, id DESC`.
CREATE INDEX "SupplyChainTwinIngestEvent_tenantId_createdAt_id_idx"
ON "SupplyChainTwinIngestEvent"("tenantId", "createdAt", "id");

-- Query pattern: `/api/supply-chain-twin/events` exact/prefix type filtering
-- `WHERE tenantId = ? AND type ...` (+ optional createdAt window) with the same keyset ordering.
CREATE INDEX "SupplyChainTwinIngestEvent_tenantId_type_createdAt_id_idx"
ON "SupplyChainTwinIngestEvent"("tenantId", "type", "createdAt", "id");
