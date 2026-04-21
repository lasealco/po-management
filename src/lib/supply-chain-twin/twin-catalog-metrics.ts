import { prisma } from "@/lib/prisma";

/** Integer counts only — no row payloads. The metrics route adds `generatedAt` (see `twinCatalogMetricsResponseSchema`). */
export type TwinCatalogMetricsCounts = {
  entities: number;
  edges: number;
  events: number;
  scenarioDrafts: number;
  riskSignals: number;
};

/**
 * Loads tenant-scoped catalog sizes using five indexed `COUNT(*)` queries in one transaction.
 *
 * **Operational note:** Each query is bounded by `tenantId` + existing indexes (see Prisma models). There is no table
 * scan of payloads. For very large tenants, consider a follow-up with DB statement timeout or materialized rollups —
 * not required for the preview twin.
 */
export async function getTwinCatalogMetricsForTenant(tenantId: string): Promise<TwinCatalogMetricsCounts> {
  const [entities, edges, events, scenarioDrafts, riskSignals] = await prisma.$transaction([
    prisma.supplyChainTwinEntitySnapshot.count({ where: { tenantId } }),
    prisma.supplyChainTwinEntityEdge.count({ where: { tenantId } }),
    prisma.supplyChainTwinIngestEvent.count({ where: { tenantId } }),
    prisma.supplyChainTwinScenarioDraft.count({ where: { tenantId } }),
    prisma.supplyChainTwinRiskSignal.count({ where: { tenantId } }),
  ]);

  return { entities, edges, events, scenarioDrafts, riskSignals };
}
