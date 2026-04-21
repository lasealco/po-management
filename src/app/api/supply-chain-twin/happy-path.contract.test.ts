import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTwinApiAccessMock = vi.fn();
const getSupplyChainTwinReadinessSnapshotMock = vi.fn();
const listForTenantPageMock = vi.fn();
const getTwinCatalogMetricsForTenantMock = vi.fn();

vi.mock("@/lib/supply-chain-twin/sctwin-api-access", () => ({
  requireTwinApiAccess: requireTwinApiAccessMock,
}));

vi.mock("@/lib/supply-chain-twin/readiness", () => ({
  getSupplyChainTwinReadinessSnapshot: getSupplyChainTwinReadinessSnapshotMock,
}));

vi.mock("@/lib/supply-chain-twin/repo", () => ({
  listForTenantPage: listForTenantPageMock,
}));

vi.mock("@/lib/supply-chain-twin/twin-catalog-metrics", () => ({
  getTwinCatalogMetricsForTenant: getTwinCatalogMetricsForTenantMock,
}));

import { twinEntitiesListResponseSchema, twinCatalogMetricsResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { twinReadinessResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-readiness-response";

describe("Supply Chain Twin API happy path contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTwinApiAccessMock.mockResolvedValue({
      ok: true,
      access: { tenant: { id: "t1", slug: "demo-company", name: "Demo Co" } },
    });
  });

  it("returns 200 for readiness, entities(summary), and metrics with schema-valid payloads", async () => {
    getSupplyChainTwinReadinessSnapshotMock.mockResolvedValue({
      ok: true,
      reasons: [],
      healthIndex: { mode: "stub", score: 72, disclaimer: "non_production" },
      hasTwinData: true,
    });
    listForTenantPageMock.mockResolvedValue({
      items: [
        {
          id: "snap_1",
          ref: { kind: "supplier", id: "SUP-001" },
        },
      ],
      nextCursor: undefined,
    });
    getTwinCatalogMetricsForTenantMock.mockResolvedValue({
      entities: 1,
      edges: 0,
      events: 2,
      scenarioDrafts: 2,
      riskSignals: 2,
      entityCountsByKind: {
        supplier: 1,
        site: 0,
        purchase_order: 0,
        shipment: 0,
        sku: 0,
        warehouse: 0,
        unknown: 0,
        other: 0,
      },
    });

    const { GET: readinessGET } = await import("./readiness/route");
    const { GET: entitiesGET } = await import("./entities/route");
    const { GET: metricsGET } = await import("./metrics/route");

    const readinessRes = await readinessGET(new Request("http://localhost/api/supply-chain-twin/readiness"));
    expect(readinessRes.status).toBe(200);
    const readinessJson = await readinessRes.json();
    expect(() => twinReadinessResponseSchema.parse(readinessJson)).not.toThrow();

    const entitiesRes = await entitiesGET(
      new Request("http://localhost/api/supply-chain-twin/entities?fields=summary&limit=1"),
    );
    expect(entitiesRes.status).toBe(200);
    const entitiesJson = await entitiesRes.json();
    expect(() => twinEntitiesListResponseSchema.parse(entitiesJson)).not.toThrow();

    const metricsRes = await metricsGET(new Request("http://localhost/api/supply-chain-twin/metrics"));
    expect(metricsRes.status).toBe(200);
    const metricsJson = await metricsRes.json();
    expect(() => twinCatalogMetricsResponseSchema.parse(metricsJson)).not.toThrow();
  });
});
