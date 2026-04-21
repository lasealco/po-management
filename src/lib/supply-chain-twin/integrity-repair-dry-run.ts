import { prisma } from "@/lib/prisma";

export type TwinIntegrityRepairActionType =
  | "delete_orphan_edge_missing_from_snapshot"
  | "delete_orphan_edge_missing_to_snapshot"
  | "delete_orphan_scenario_revision_missing_draft";

export type TwinIntegrityRepairProposal = {
  action: TwinIntegrityRepairActionType;
  targetId: string;
  reason: string;
};

export type TwinIntegrityRepairDryRunSummary = {
  checkedAt: string;
  tenantId: string;
  dryRun: true;
  proposedFixCount: number;
  proposedFixesByType: Record<TwinIntegrityRepairActionType, number>;
  proposals: TwinIntegrityRepairProposal[];
};

/**
 * Enumerates candidate repairs for Twin integrity issues without applying writes.
 * Output is stable, machine-readable, and bounded by `maxProposals`.
 */
export async function getTwinIntegrityRepairDryRunForTenant(
  tenantId: string,
  options: { maxProposals?: number } = {},
): Promise<TwinIntegrityRepairDryRunSummary> {
  const maxProposals = Math.min(Math.max(options.maxProposals ?? 500, 1), 5000);

  const [entitySnapshots, edges, scenarioDrafts, scenarioRevisions] = await Promise.all([
    prisma.supplyChainTwinEntitySnapshot.findMany({
      where: { tenantId },
      select: { id: true },
    }),
    prisma.supplyChainTwinEntityEdge.findMany({
      where: { tenantId },
      select: { id: true, fromSnapshotId: true, toSnapshotId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.supplyChainTwinScenarioDraft.findMany({
      where: { tenantId },
      select: { id: true },
    }),
    prisma.supplyChainTwinScenarioRevision.findMany({
      where: { tenantId },
      select: { id: true, scenarioDraftId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const snapshotIds = new Set(entitySnapshots.map((row) => row.id));
  const scenarioDraftIds = new Set(scenarioDrafts.map((row) => row.id));

  const proposals: TwinIntegrityRepairProposal[] = [];
  const proposedFixesByType: TwinIntegrityRepairDryRunSummary["proposedFixesByType"] = {
    delete_orphan_edge_missing_from_snapshot: 0,
    delete_orphan_edge_missing_to_snapshot: 0,
    delete_orphan_scenario_revision_missing_draft: 0,
  };

  const maybePushProposal = (proposal: TwinIntegrityRepairProposal) => {
    proposedFixesByType[proposal.action] += 1;
    if (proposals.length < maxProposals) {
      proposals.push(proposal);
    }
  };

  for (const edge of edges) {
    if (!snapshotIds.has(edge.fromSnapshotId)) {
      maybePushProposal({
        action: "delete_orphan_edge_missing_from_snapshot",
        targetId: edge.id,
        reason: `fromSnapshotId ${edge.fromSnapshotId} does not exist in tenant scope.`,
      });
    }
    if (!snapshotIds.has(edge.toSnapshotId)) {
      maybePushProposal({
        action: "delete_orphan_edge_missing_to_snapshot",
        targetId: edge.id,
        reason: `toSnapshotId ${edge.toSnapshotId} does not exist in tenant scope.`,
      });
    }
  }

  for (const revision of scenarioRevisions) {
    if (!scenarioDraftIds.has(revision.scenarioDraftId)) {
      maybePushProposal({
        action: "delete_orphan_scenario_revision_missing_draft",
        targetId: revision.id,
        reason: `scenarioDraftId ${revision.scenarioDraftId} does not exist in tenant scope.`,
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    tenantId,
    dryRun: true,
    proposedFixCount:
      proposedFixesByType.delete_orphan_edge_missing_from_snapshot +
      proposedFixesByType.delete_orphan_edge_missing_to_snapshot +
      proposedFixesByType.delete_orphan_scenario_revision_missing_draft,
    proposedFixesByType,
    proposals,
  };
}
