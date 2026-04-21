import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinEntityEdge: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { listEdgesForEntity, listEdgesForTenant } from "@/lib/supply-chain-twin/edges-repo";

beforeEach(() => {
  vi.mocked(prismaMock.supplyChainTwinEntityEdge.findMany).mockReset();
});

describe("listEdgesForTenant", () => {
  it("returns empty when Prisma returns no rows", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntityEdge.findMany).mockResolvedValueOnce([]);

    const out = await listEdgesForTenant("tenant-1");

    expect(out).toEqual([]);
    expect(prismaMock.supplyChainTwinEntityEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
        take: 200,
      }),
    );
  });

  it("maps rows and applies fromSnapshotId filter", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntityEdge.findMany).mockResolvedValueOnce([
      {
        id: "e1",
        relation: "ships_to",
        fromSnapshot: { entityKind: "supplier", entityKey: "S1" },
        toSnapshot: { entityKind: "site", entityKey: "WH1" },
      },
    ]);

    const out = await listEdgesForTenant("tenant-1", { fromSnapshotId: "snap-a", take: 50 });

    expect(out).toEqual([
      {
        id: "e1",
        relation: "ships_to",
        from: { kind: "supplier", id: "S1" },
        to: { kind: "site", id: "WH1" },
      },
    ]);
    expect(prismaMock.supplyChainTwinEntityEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", fromSnapshotId: "snap-a" },
        take: 50,
      }),
    );
  });
});

describe("listEdgesForEntity", () => {
  it("delegates to listEdgesForTenant for direction out", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntityEdge.findMany).mockResolvedValueOnce([]);

    await listEdgesForEntity("t1", "snap-x", { direction: "out", take: 10 });

    expect(prismaMock.supplyChainTwinEntityEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", fromSnapshotId: "snap-x" },
        take: 10,
      }),
    );
  });

  it("delegates to listEdgesForTenant for direction in", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntityEdge.findMany).mockResolvedValueOnce([]);

    await listEdgesForEntity("t1", "snap-x", { direction: "in" });

    expect(prismaMock.supplyChainTwinEntityEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", toSnapshotId: "snap-x" },
        take: 200,
      }),
    );
  });

  it("uses OR filter for direction both", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntityEdge.findMany).mockResolvedValueOnce([]);

    await listEdgesForEntity("t1", "snap-x", { direction: "both" });

    expect(prismaMock.supplyChainTwinEntityEdge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t1",
          OR: [{ fromSnapshotId: "snap-x" }, { toSnapshotId: "snap-x" }],
        },
        take: 200,
      }),
    );
  });
});
