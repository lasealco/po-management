import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinEntitySnapshot: { findMany: vi.fn() },
    supplyChainTwinEntityEdge: { findMany: vi.fn() },
    supplyChainTwinScenarioDraft: { findMany: vi.fn() },
    supplyChainTwinScenarioRevision: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { getTwinIntegrityRepairDryRunForTenant } from "@/lib/supply-chain-twin/integrity-repair-dry-run";

describe("getTwinIntegrityRepairDryRunForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty proposal list when no integrity issues exist", async () => {
    prismaMock.supplyChainTwinEntitySnapshot.findMany.mockResolvedValue([{ id: "snap-1" }, { id: "snap-2" }]);
    prismaMock.supplyChainTwinEntityEdge.findMany.mockResolvedValue([
      { id: "edge-1", fromSnapshotId: "snap-1", toSnapshotId: "snap-2" },
    ]);
    prismaMock.supplyChainTwinScenarioDraft.findMany.mockResolvedValue([{ id: "draft-1" }]);
    prismaMock.supplyChainTwinScenarioRevision.findMany.mockResolvedValue([
      { id: "rev-1", scenarioDraftId: "draft-1" },
    ]);

    const out = await getTwinIntegrityRepairDryRunForTenant("tenant-1");

    expect(out.dryRun).toBe(true);
    expect(out.tenantId).toBe("tenant-1");
    expect(out.proposedFixCount).toBe(0);
    expect(out.proposals).toEqual([]);
    expect(out.proposedFixesByType).toEqual({
      delete_orphan_edge_missing_from_snapshot: 0,
      delete_orphan_edge_missing_to_snapshot: 0,
      delete_orphan_scenario_revision_missing_draft: 0,
    });
  });

  it("enumerates proposals in stable order and caps output list", async () => {
    prismaMock.supplyChainTwinEntitySnapshot.findMany.mockResolvedValue([{ id: "snap-1" }]);
    prismaMock.supplyChainTwinEntityEdge.findMany.mockResolvedValue([
      { id: "edge-a", fromSnapshotId: "snap-missing-a", toSnapshotId: "snap-1" },
      { id: "edge-b", fromSnapshotId: "snap-1", toSnapshotId: "snap-missing-b" },
      { id: "edge-c", fromSnapshotId: "snap-missing-c", toSnapshotId: "snap-missing-d" },
    ]);
    prismaMock.supplyChainTwinScenarioDraft.findMany.mockResolvedValue([{ id: "draft-1" }]);
    prismaMock.supplyChainTwinScenarioRevision.findMany.mockResolvedValue([
      { id: "rev-1", scenarioDraftId: "draft-missing" },
    ]);

    const out = await getTwinIntegrityRepairDryRunForTenant("tenant-1", { maxProposals: 3 });

    expect(out.proposedFixCount).toBe(5);
    expect(out.proposedFixesByType).toEqual({
      delete_orphan_edge_missing_from_snapshot: 2,
      delete_orphan_edge_missing_to_snapshot: 2,
      delete_orphan_scenario_revision_missing_draft: 1,
    });
    expect(out.proposals).toHaveLength(3);
    expect(out.proposals.map((p) => [p.action, p.targetId])).toEqual([
      ["delete_orphan_edge_missing_from_snapshot", "edge-a"],
      ["delete_orphan_edge_missing_to_snapshot", "edge-b"],
      ["delete_orphan_edge_missing_from_snapshot", "edge-c"],
    ]);
  });
});
