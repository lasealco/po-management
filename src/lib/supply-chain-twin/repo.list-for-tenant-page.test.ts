import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinEntitySnapshot: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { listForTenantPage } from "@/lib/supply-chain-twin/repo";

beforeEach(() => {
  vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findMany).mockReset();
});

describe("listForTenantPage", () => {
  it("uses a select without payload in summary mode", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findMany).mockResolvedValueOnce([]);

    await listForTenantPage("tenant-1", { limit: 10, fields: "summary" });

    expect(prismaMock.supplyChainTwinEntitySnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, entityKind: true, entityKey: true, updatedAt: true },
      }),
    );
  });

  it("includes payload in select for full mode", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findMany).mockResolvedValueOnce([]);

    await listForTenantPage("tenant-1", { limit: 10, fields: "full" });

    expect(prismaMock.supplyChainTwinEntitySnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, entityKind: true, entityKey: true, updatedAt: true, payload: true },
      }),
    );
  });

  it("maps payload onto items in full mode", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findMany).mockResolvedValueOnce([
      {
        id: "s1",
        entityKind: "supplier",
        entityKey: "K1",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        payload: { x: 1 },
      },
    ]);

    const out = await listForTenantPage("tenant-1", { limit: 10, fields: "full" });

    expect(out.items).toEqual([
      { id: "s1", ref: { kind: "supplier", id: "K1" }, payload: { x: 1 } },
    ]);
  });

  it("omits payload on items in summary mode", async () => {
    vi.mocked(prismaMock.supplyChainTwinEntitySnapshot.findMany).mockResolvedValueOnce([
      {
        id: "s1",
        entityKind: "supplier",
        entityKey: "K1",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const out = await listForTenantPage("tenant-1", { limit: 10, fields: "summary" });

    expect(out.items[0]).toEqual({ id: "s1", ref: { kind: "supplier", id: "K1" } });
    expect(out.items[0]).not.toHaveProperty("payload");
  });
});
