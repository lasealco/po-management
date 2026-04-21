-- Query pattern: GET /api/supply-chain-twin/events always scopes by tenant and often applies
-- a createdAt window (`since` / `until`) with optional `type` filter on the same request.
-- This index keeps the time window selective while retaining `type` in the index tuple.
CREATE INDEX "SupplyChainTwinIngestEvent_tenantId_createdAt_type_idx"
ON "SupplyChainTwinIngestEvent"("tenantId", "createdAt", "type");
