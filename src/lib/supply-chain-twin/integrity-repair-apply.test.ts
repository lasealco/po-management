import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, dryRunMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinEntityEdge: { deleteMany: vi.fn() },
    supplyChainTwinScenarioRevision: { deleteMany: vi.fn() },
  },
  dryRunMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/supply-chain-twin/integrity-repair-dry-run", () => ({
  getTwinIntegrityRepairDryRunForTenant: dryRunMock,
}));

import { applyTwinIntegrityRepairsForTenant } from "@/lib/supply-chain-twin/integrity-repair-apply";

describe("applyTwinIntegrityRepairsForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies planned actions and records audit rows", async () => {
    dryRunMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "tenant-1",
      dryRun: true,
      proposedFixCount: 3,
      proposedFixesByType: {
        delete_orphan_edge_missing_from_snapshot: 1,
        delete_orphan_edge_missing_to_snapshot: 1,
        delete_orphan_scenario_revision_missing_draft: 1,
      },
      proposals: [
        {
          action: "delete_orphan_edge_missing_from_snapshot",
          targetId: "edge-1",
          reason: "fromSnapshotId snap-a missing",
        },
        {
          action: "delete_orphan_edge_missing_to_snapshot",
          targetId: "edge-2",
          reason: "toSnapshotId snap-b missing",
        },
        {
          action: "delete_orphan_scenario_revision_missing_draft",
          targetId: "rev-1",
          reason: "scenarioDraftId draft-x missing",
        },
      ],
    });
    prismaMock.supplyChainTwinEntityEdge.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.supplyChainTwinEntityEdge.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.supplyChainTwinScenarioRevision.deleteMany.mockResolvedValueOnce({ count: 1 });

    const out = await applyTwinIntegrityRepairsForTenant("tenant-1");

    expect(out.dryRun).toBe(false);
    expect(out.confirmed).toBe(true);
    expect(out.attemptedActionCount).toBe(3);
    expect(out.appliedActionCount).toBe(2);
    expect(out.auditRecords).toEqual([
      {
        action: "delete_orphan_edge_missing_from_snapshot",
        targetId: "edge-1",
        reason: "fromSnapshotId snap-a missing",
        applied: true,
        affectedRows: 1,
      },
      {
        action: "delete_orphan_edge_missing_to_snapshot",
        targetId: "edge-2",
        reason: "toSnapshotId snap-b missing",
        applied: false,
        affectedRows: 0,
      },
      {
        action: "delete_orphan_scenario_revision_missing_draft",
        targetId: "rev-1",
        reason: "scenarioDraftId draft-x missing",
        applied: true,
        affectedRows: 1,
      },
    ]);
  });

  it("respects maxActions limit", async () => {
    dryRunMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "tenant-1",
      dryRun: true,
      proposedFixCount: 2,
      proposedFixesByType: {
        delete_orphan_edge_missing_from_snapshot: 2,
        delete_orphan_edge_missing_to_snapshot: 0,
        delete_orphan_scenario_revision_missing_draft: 0,
      },
      proposals: [
        {
          action: "delete_orphan_edge_missing_from_snapshot",
          targetId: "edge-1",
          reason: "missing A",
        },
        {
          action: "delete_orphan_edge_missing_from_snapshot",
          targetId: "edge-2",
          reason: "missing B",
        },
      ],
    });
    prismaMock.supplyChainTwinEntityEdge.deleteMany.mockResolvedValue({ count: 1 });

    const out = await applyTwinIntegrityRepairsForTenant("tenant-1", { maxActions: 1 });

    expect(out.attemptedActionCount).toBe(1);
    expect(prismaMock.supplyChainTwinEntityEdge.deleteMany).toHaveBeenCalledTimes(1);
  });
});
