import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinEntitySnapshot: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { getEntitySnapshotByIdForTenant } from "@/lib/supply-chain-twin/repo";

beforeEach(() => {
  vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findFirst).mockReset();
});

describe("getEntitySnapshotByIdForTenant", () => {
  it("returns null when Prisma finds no row", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findFirst).mockResolvedValueOnce(null);

    const out = await getEntitySnapshotByIdForTenant("tenant-1", "snap-x");

    expect(out).toBeNull();
    expect(prismaMock.supplyChainTwinEntitySnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", id: "snap-x" },
      }),
    );
  });

  it("maps row to detail DTO", async () => {
    const createdAt = new Date("2026-03-01T12:00:00.000Z");
    const updatedAt = new Date("2026-03-02T12:00:00.000Z");
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findFirst).mockResolvedValueOnce({
      id: "snap-1",
      entityKind: "supplier",
      entityKey: "KEY1",
      payload: { a: 1 },
      createdAt,
      updatedAt,
    });

    const out = await getEntitySnapshotByIdForTenant("tenant-1", "snap-1");

    expect(out).toEqual({
      id: "snap-1",
      ref: { kind: "supplier", id: "KEY1" },
      createdAt,
      updatedAt,
      payload: { a: 1 },
    });
  });
});
