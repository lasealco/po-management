-- Query pattern: GET /api/supply-chain-twin/scenarios uses tenant-scoped keyset ordering by
-- (updatedAt DESC, id DESC); include id in the tuple to keep tie-break pagination index-aligned.
CREATE INDEX "SupplyChainTwinScenarioDraft_tenantId_updatedAt_id_idx"
ON "SupplyChainTwinScenarioDraft"("tenantId", "updatedAt", "id");

-- Query pattern: GET /api/supply-chain-twin/scenarios/[id]/history lists revisions newest-first
-- with keyset-friendly tie-break on (createdAt DESC, id DESC) inside tenant + scenarioDraft scope.
CREATE INDEX "sctwin_scen_rev_draft_created_id_idx"
ON "SupplyChainTwinScenarioRevision"("tenantId", "scenarioDraftId", "createdAt", "id");
