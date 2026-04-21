import { prisma } from "@/lib/prisma";
import { TWIN_ENTITY_KINDS, type TwinEntityKind } from "@/lib/supply-chain-twin/types";

/** Bounded map for metrics: every known {@link TwinEntityKind} plus `other` for unknown stored `entityKind` strings. */
export type TwinEntityCountsByKind = Record<TwinEntityKind, number> & { other: number };

function emptyEntityCountsByKind(): TwinEntityCountsByKind {
  const out = { other: 0 } as TwinEntityCountsByKind;
  for (const k of TWIN_ENTITY_KINDS) {
    out[k] = 0;
  }
  return out;
}

function rollupEntityCountsByKind(
  rows: Array<{ entityKind: string; _count: { _all: number } }>,
): TwinEntityCountsByKind {
  const out = emptyEntityCountsByKind();
  const known = new Set<string>(TWIN_ENTITY_KINDS as readonly string[]);
  for (const row of rows) {
    const n = row._count._all;
    if (known.has(row.entityKind)) {
      out[row.entityKind as TwinEntityKind] += n;
    } else {
      out.other += n;
    }
  }
  return out;
}

/** Integer counts only — no row payloads. The metrics route adds `generatedAt` (see `twinCatalogMetricsResponseSchema`). */
export type TwinCatalogMetricsCounts = {
  entities: number;
  edges: number;
  events: number;
  scenarioDrafts: number;
  riskSignals: number;
  entityCountsByKind: TwinEntityCountsByKind;
};

/**
 * Loads tenant-scoped catalog sizes using six indexed queries in one transaction: five `COUNT(*)` plus one
 * `GROUP BY entityKind` on `SupplyChainTwinEntitySnapshot` (tenant filter uses `@@index([tenantId])` /
 * `@@index([tenantId, entityKind])`). No payload columns — bounded result width (one row per distinct kind in DB).
 */
export async function getTwinCatalogMetricsForTenant(tenantId: string): Promise<TwinCatalogMetricsCounts> {
  const [entities, edges, events, scenarioDrafts, riskSignals, entityKindGroups] = await prisma.$transaction([
    prisma.supplyChainTwinEntitySnapshot.count({ where: { tenantId } }),
    prisma.supplyChainTwinEntityEdge.count({ where: { tenantId } }),
    prisma.supplyChainTwinIngestEvent.count({ where: { tenantId } }),
    prisma.supplyChainTwinScenarioDraft.count({ where: { tenantId } }),
    prisma.supplyChainTwinRiskSignal.count({ where: { tenantId } }),
    prisma.supplyChainTwinEntitySnapshot.groupBy({
      by: ["entityKind"],
      where: { tenantId },
      orderBy: { entityKind: "asc" },
      _count: { _all: true },
    }),
  ]);

  const kindRows = entityKindGroups as Array<{ entityKind: string; _count: { _all: number } }>;

  return {
    entities,
    edges,
    events,
    scenarioDrafts,
    riskSignals,
    entityCountsByKind: rollupEntityCountsByKind(kindRows),
  };
}
