import { prisma } from "@/lib/prisma";

export type TwinIntegrityIssueCounts = {
  orphanEdgeFromSnapshotRefs: number;
  orphanEdgeToSnapshotRefs: number;
  orphanScenarioRevisionRefs: number;
};

export type TwinIntegrityIssueSamples = {
  orphanEdgeFromSnapshotEdgeIds: string[];
  orphanEdgeToSnapshotEdgeIds: string[];
  orphanScenarioRevisionIds: string[];
};

export type TwinIntegrityCheckSummary = {
  checkedAt: string;
  tenantId: string;
  ok: boolean;
  totals: {
    entitySnapshots: number;
    edges: number;
    scenarioDrafts: number;
    scenarioRevisions: number;
  };
  issues: TwinIntegrityIssueCounts;
  invalidReferenceCount: number;
  samples: TwinIntegrityIssueSamples;
};

function pushSample(target: string[], id: string, sampleLimit: number) {
  if (target.length < sampleLimit) {
    target.push(id);
  }
}

/**
 * Read-only integrity scan for one tenant.
 * Detects edges/revisions that reference rows missing from the same tenant scope.
 */
export async function getTwinIntegritySummaryForTenant(
  tenantId: string,
  options: { sampleLimit?: number } = {},
): Promise<TwinIntegrityCheckSummary> {
  const sampleLimit = Math.min(Math.max(options.sampleLimit ?? 20, 1), 100);

  const [entitySnapshots, edges, scenarioDrafts, scenarioRevisions] = await Promise.all([
    prisma.supplyChainTwinEntitySnapshot.findMany({
      where: { tenantId },
      select: { id: true },
    }),
    prisma.supplyChainTwinEntityEdge.findMany({
      where: { tenantId },
      select: { id: true, fromSnapshotId: true, toSnapshotId: true },
    }),
    prisma.supplyChainTwinScenarioDraft.findMany({
      where: { tenantId },
      select: { id: true },
    }),
    prisma.supplyChainTwinScenarioRevision.findMany({
      where: { tenantId },
      select: { id: true, scenarioDraftId: true },
    }),
  ]);

  const snapshotIds = new Set(entitySnapshots.map((row) => row.id));
  const scenarioDraftIds = new Set(scenarioDrafts.map((row) => row.id));

  const samples: TwinIntegrityIssueSamples = {
    orphanEdgeFromSnapshotEdgeIds: [],
    orphanEdgeToSnapshotEdgeIds: [],
    orphanScenarioRevisionIds: [],
  };

  const issues: TwinIntegrityIssueCounts = {
    orphanEdgeFromSnapshotRefs: 0,
    orphanEdgeToSnapshotRefs: 0,
    orphanScenarioRevisionRefs: 0,
  };

  for (const edge of edges) {
    if (!snapshotIds.has(edge.fromSnapshotId)) {
      issues.orphanEdgeFromSnapshotRefs += 1;
      pushSample(samples.orphanEdgeFromSnapshotEdgeIds, edge.id, sampleLimit);
    }
    if (!snapshotIds.has(edge.toSnapshotId)) {
      issues.orphanEdgeToSnapshotRefs += 1;
      pushSample(samples.orphanEdgeToSnapshotEdgeIds, edge.id, sampleLimit);
    }
  }

  for (const revision of scenarioRevisions) {
    if (!scenarioDraftIds.has(revision.scenarioDraftId)) {
      issues.orphanScenarioRevisionRefs += 1;
      pushSample(samples.orphanScenarioRevisionIds, revision.id, sampleLimit);
    }
  }

  const invalidReferenceCount =
    issues.orphanEdgeFromSnapshotRefs + issues.orphanEdgeToSnapshotRefs + issues.orphanScenarioRevisionRefs;

  return {
    checkedAt: new Date().toISOString(),
    tenantId,
    ok: invalidReferenceCount === 0,
    totals: {
      entitySnapshots: entitySnapshots.length,
      edges: edges.length,
      scenarioDrafts: scenarioDrafts.length,
      scenarioRevisions: scenarioRevisions.length,
    },
    issues,
    invalidReferenceCount,
    samples,
  };
}
