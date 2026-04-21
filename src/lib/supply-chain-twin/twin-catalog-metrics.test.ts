import { beforeEach, describe, expect, it, vi } from "vitest";

import { TWIN_ENTITY_KINDS } from "@/lib/supply-chain-twin/types";

const entityCount = vi.fn();
const entityGroupBy = vi.fn();
const edgeCount = vi.fn();
const eventCount = vi.fn();
const draftCount = vi.fn();
const riskCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplyChainTwinEntitySnapshot: {
      count: (...a: unknown[]) => entityCount(...a),
      groupBy: (...a: unknown[]) => entityGroupBy(...a),
    },
    supplyChainTwinEntityEdge: { count: (...a: unknown[]) => edgeCount(...a) },
    supplyChainTwinIngestEvent: { count: (...a: unknown[]) => eventCount(...a) },
    supplyChainTwinScenarioDraft: { count: (...a: unknown[]) => draftCount(...a) },
    supplyChainTwinRiskSignal: { count: (...a: unknown[]) => riskCount(...a) },
    $transaction: (queries: Array<Promise<unknown>>) => Promise.all(queries) as Promise<unknown[]>,
  },
}));

describe("getTwinCatalogMetricsForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entityCount.mockResolvedValue(3);
    entityGroupBy.mockResolvedValue([
      { entityKind: "supplier", _count: { _all: 2 } },
      { entityKind: "site", _count: { _all: 1 } },
    ]);
    edgeCount.mockResolvedValue(1);
    eventCount.mockResolvedValue(12);
    draftCount.mockResolvedValue(2);
    riskCount.mockResolvedValue(0);
  });

  it("returns counts and scopes each query to tenantId", async () => {
    const { getTwinCatalogMetricsForTenant } = await import("./twin-catalog-metrics");
    const byKind = Object.fromEntries([...TWIN_ENTITY_KINDS, "other"].map((k) => [k, 0])) as Record<string, number>;
    byKind.supplier = 2;
    byKind.site = 1;
    await expect(getTwinCatalogMetricsForTenant("tenant-a")).resolves.toEqual({
      entities: 3,
      edges: 1,
      events: 12,
      scenarioDrafts: 2,
      riskSignals: 0,
      entityCountsByKind: byKind,
    });
    const where = { where: { tenantId: "tenant-a" } };
    expect(entityCount).toHaveBeenCalledWith(where);
    expect(entityGroupBy).toHaveBeenCalledWith({
      by: ["entityKind"],
      where: { tenantId: "tenant-a" },
      orderBy: { entityKind: "asc" },
      _count: { _all: true },
    });
    expect(edgeCount).toHaveBeenCalledWith(where);
    expect(eventCount).toHaveBeenCalledWith(where);
    expect(draftCount).toHaveBeenCalledWith(where);
    expect(riskCount).toHaveBeenCalledWith(where);
  });

  it("rolls unknown entityKind values into other", async () => {
    entityCount.mockResolvedValue(4);
    entityGroupBy.mockResolvedValue([
      { entityKind: "supplier", _count: { _all: 1 } },
      { entityKind: "not_a_catalog_kind", _count: { _all: 3 } },
    ]);
    const { getTwinCatalogMetricsForTenant } = await import("./twin-catalog-metrics");
    const out = await getTwinCatalogMetricsForTenant("tenant-x");
    expect(out.entities).toBe(4);
    expect(out.entityCountsByKind.supplier).toBe(1);
    expect(out.entityCountsByKind.other).toBe(3);
    expect(out.entityCountsByKind.site).toBe(0);
  });
});
