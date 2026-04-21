import { beforeEach, describe, expect, it, vi } from "vitest";

const entityCount = vi.fn();
const edgeCount = vi.fn();
const eventCount = vi.fn();
const draftCount = vi.fn();
const riskCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplyChainTwinEntitySnapshot: { count: (...a: unknown[]) => entityCount(...a) },
    supplyChainTwinEntityEdge: { count: (...a: unknown[]) => edgeCount(...a) },
    supplyChainTwinIngestEvent: { count: (...a: unknown[]) => eventCount(...a) },
    supplyChainTwinScenarioDraft: { count: (...a: unknown[]) => draftCount(...a) },
    supplyChainTwinRiskSignal: { count: (...a: unknown[]) => riskCount(...a) },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries) as Promise<number[]>,
  },
}));

describe("getTwinCatalogMetricsForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityCount.mockResolvedValue(3);
    edgeCount.mockResolvedValue(1);
    eventCount.mockResolvedValue(12);
    draftCount.mockResolvedValue(2);
    riskCount.mockResolvedValue(0);
  });

  it("returns counts and scopes each query to tenantId", async () => {
    const { getTwinCatalogMetricsForTenant } = await import("./twin-catalog-metrics");
    await expect(getTwinCatalogMetricsForTenant("tenant-a")).resolves.toEqual({
      entities: 3,
      edges: 1,
      events: 12,
      scenarioDrafts: 2,
      riskSignals: 0,
    });
    const where = { where: { tenantId: "tenant-a" } };
    expect(entityCount).toHaveBeenCalledWith(where);
    expect(edgeCount).toHaveBeenCalledWith(where);
    expect(eventCount).toHaveBeenCalledWith(where);
    expect(draftCount).toHaveBeenCalledWith(where);
    expect(riskCount).toHaveBeenCalledWith(where);
  });
});
