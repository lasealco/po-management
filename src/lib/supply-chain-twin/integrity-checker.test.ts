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

import { getTwinIntegritySummaryForTenant } from "@/lib/supply-chain-twin/integrity-checker";

describe("getTwinIntegritySummaryForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok=true when all references are valid", async () => {
    prismaMock.supplyChainTwinEntitySnapshot.findMany.mockResolvedValue([{ id: "snap-1" }, { id: "snap-2" }]);
    prismaMock.supplyChainTwinEntityEdge.findMany.mockResolvedValue([
      { id: "edge-1", fromSnapshotId: "snap-1", toSnapshotId: "snap-2" },
    ]);
    prismaMock.supplyChainTwinScenarioDraft.findMany.mockResolvedValue([{ id: "draft-1" }]);
    prismaMock.supplyChainTwinScenarioRevision.findMany.mockResolvedValue([
      { id: "rev-1", scenarioDraftId: "draft-1" },
    ]);

    const out = await getTwinIntegritySummaryForTenant("tenant-1");

    expect(out.tenantId).toBe("tenant-1");
    expect(out.ok).toBe(true);
    expect(out.invalidReferenceCount).toBe(0);
    expect(out.issues).toEqual({
      orphanEdgeFromSnapshotRefs: 0,
      orphanEdgeToSnapshotRefs: 0,
      orphanScenarioRevisionRefs: 0,
    });
    expect(out.totals).toEqual({
      entitySnapshots: 2,
      edges: 1,
      scenarioDrafts: 1,
      scenarioRevisions: 1,
    });
  });

  it("counts orphan references and caps samples", async () => {
    prismaMock.supplyChainTwinEntitySnapshot.findMany.mockResolvedValue([{ id: "snap-1" }]);
    prismaMock.supplyChainTwinEntityEdge.findMany.mockResolvedValue([
      { id: "edge-1", fromSnapshotId: "snap-missing-a", toSnapshotId: "snap-1" },
      { id: "edge-2", fromSnapshotId: "snap-1", toSnapshotId: "snap-missing-b" },
      { id: "edge-3", fromSnapshotId: "snap-missing-c", toSnapshotId: "snap-missing-d" },
    ]);
    prismaMock.supplyChainTwinScenarioDraft.findMany.mockResolvedValue([{ id: "draft-1" }]);
    prismaMock.supplyChainTwinScenarioRevision.findMany.mockResolvedValue([
      { id: "rev-1", scenarioDraftId: "draft-missing-a" },
      { id: "rev-2", scenarioDraftId: "draft-missing-b" },
    ]);

    const out = await getTwinIntegritySummaryForTenant("tenant-1", { sampleLimit: 2 });

    expect(out.ok).toBe(false);
    expect(out.issues).toEqual({
      orphanEdgeFromSnapshotRefs: 2,
      orphanEdgeToSnapshotRefs: 2,
      orphanScenarioRevisionRefs: 2,
    });
    expect(out.invalidReferenceCount).toBe(6);
    expect(out.samples).toEqual({
      orphanEdgeFromSnapshotEdgeIds: ["edge-1", "edge-3"],
      orphanEdgeToSnapshotEdgeIds: ["edge-2", "edge-3"],
      orphanScenarioRevisionIds: ["rev-1", "rev-2"],
    });
  });
});
