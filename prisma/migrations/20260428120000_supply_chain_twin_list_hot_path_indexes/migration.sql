-- Slice 66 — Supply Chain Twin: list hot-path composite indexes (twin tables only).
--
-- Query patterns (see `src/lib/supply-chain-twin/repo.ts` and `risk-signals-repo.ts`):
-- 1) Entity catalog keyset pages: `WHERE tenantId = ?` (+ optional filters), `ORDER BY updatedAt DESC, id DESC`.
--    Existing `(tenantId)` and `(tenantId, entityKind)` indexes do not cover the sort on `updatedAt`; this index does.
-- 2) Risk signal keyset pages: `WHERE tenantId = ?` (+ optional `severity`), `ORDER BY createdAt DESC, id DESC`.
--    `(tenantId, severity)` alone does not include `createdAt` for the default newest-first scan.

CREATE INDEX "SupplyChainTwinEntitySnapshot_tenantId_updatedAt_idx" ON "SupplyChainTwinEntitySnapshot"("tenantId", "updatedAt");

CREATE INDEX "SupplyChainTwinRiskSignal_tenantId_createdAt_idx" ON "SupplyChainTwinRiskSignal"("tenantId", "createdAt");
