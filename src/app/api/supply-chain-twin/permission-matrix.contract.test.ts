import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTwinApiAccessMock,
  requireTwinMaintenanceAccessMock,
  getSupplyChainTwinReadinessSnapshotMock,
  getTwinCatalogMetricsForTenantMock,
  getTwinIntegrityRepairDryRunForTenantMock,
} = vi.hoisted(() => ({
  requireTwinApiAccessMock: vi.fn(),
  requireTwinMaintenanceAccessMock: vi.fn(),
  getSupplyChainTwinReadinessSnapshotMock: vi.fn(),
  getTwinCatalogMetricsForTenantMock: vi.fn(),
  getTwinIntegrityRepairDryRunForTenantMock: vi.fn(),
}));

vi.mock("@/lib/supply-chain-twin/sctwin-api-access", () => ({
  requireTwinApiAccess: requireTwinApiAccessMock,
  requireTwinMaintenanceAccess: requireTwinMaintenanceAccessMock,
}));

vi.mock("@/lib/supply-chain-twin/readiness", () => ({
  getSupplyChainTwinReadinessSnapshot: getSupplyChainTwinReadinessSnapshotMock,
}));

vi.mock("@/lib/supply-chain-twin/twin-catalog-metrics", () => ({
  getTwinCatalogMetricsForTenant: getTwinCatalogMetricsForTenantMock,
}));

vi.mock("@/lib/supply-chain-twin/integrity-repair-dry-run", () => ({
  getTwinIntegrityRepairDryRunForTenant: getTwinIntegrityRepairDryRunForTenantMock,
}));

const accessOk = {
  ok: true as const,
  access: {
    tenant: { id: "t1", slug: "demo-company", name: "Demo Co" },
    user: { id: "u1", email: "x@y.com", name: "X" },
    grantSet: new Set<string>(),
  },
};

const denied = {
  ok: false as const,
  denied: { status: 403 as const, error: "Forbidden: test gate deny" },
};

type RouteCase = {
  name: string;
  expectAllowedStatus: number;
  invoke: () => Promise<Response>;
};

const matrix: RouteCase[] = [
  {
    name: "GET readiness (view)",
    expectAllowedStatus: 200,
    invoke: async () => {
      const { GET } = await import("./readiness/route");
      return GET(new Request("http://localhost/api/supply-chain-twin/readiness"));
    },
  },
  {
    name: "GET metrics (view)",
    expectAllowedStatus: 200,
    invoke: async () => {
      const { GET } = await import("./metrics/route");
      return GET(new Request("http://localhost/api/supply-chain-twin/metrics"));
    },
  },
  {
    name: "GET entities (view) validation path",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { GET } = await import("./entities/route");
      return GET(new Request("http://localhost/api/supply-chain-twin/entities?limit=9999"));
    },
  },
  {
    name: "GET events export (export) validation path",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { GET } = await import("./events/export/route");
      return GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=xml"));
    },
  },
  {
    name: "POST events (edit) invalid JSON path",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { POST } = await import("./events/route");
      return POST(
        new Request("http://localhost/api/supply-chain-twin/events", {
          method: "POST",
          body: "{",
        }),
      );
    },
  },
  {
    name: "POST scenarios (edit) invalid JSON path",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { POST } = await import("./scenarios/route");
      return POST(
        new Request("http://localhost/api/supply-chain-twin/scenarios", {
          method: "POST",
          body: "{",
        }),
      );
    },
  },
  {
    name: "PATCH scenario by id (edit) invalid JSON path",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { PATCH } = await import("./scenarios/[id]/route");
      return PATCH(
        new Request("http://localhost/api/supply-chain-twin/scenarios/s1", {
          method: "PATCH",
          body: "{",
        }),
        { params: Promise.resolve({ id: "s1" }) },
      );
    },
  },
  {
    name: "PATCH risk signal by id (edit) invalid body path",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { PATCH } = await import("./risk-signals/[id]/route");
      return PATCH(
        new Request("http://localhost/api/supply-chain-twin/risk-signals/r1", {
          method: "PATCH",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ id: "r1" }) },
      );
    },
  },
  {
    name: "POST integrity repair apply (admin) missing confirm",
    expectAllowedStatus: 400,
    invoke: async () => {
      const { POST } = await import("./integrity/repair-apply/route");
      return POST(
        new Request("http://localhost/api/supply-chain-twin/integrity/repair-apply", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
      );
    },
  },
  {
    name: "GET integrity repair dry-run (view)",
    expectAllowedStatus: 200,
    invoke: async () => {
      const { GET } = await import("./integrity/repair-dry-run/route");
      return GET(new Request("http://localhost/api/supply-chain-twin/integrity/repair-dry-run"));
    },
  },
];

describe("Supply Chain Twin permission matrix regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupplyChainTwinReadinessSnapshotMock.mockResolvedValue({
      ok: true,
      reasons: [],
      healthIndex: { mode: "stub", score: 80, disclaimer: "non_production" },
      hasTwinData: true,
    });
    getTwinCatalogMetricsForTenantMock.mockResolvedValue({
      entities: 1,
      edges: 1,
      events: 1,
      scenarioDrafts: 1,
      riskSignals: 1,
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
    getTwinIntegrityRepairDryRunForTenantMock.mockResolvedValue({
      checkedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      tenantId: "t1",
      dryRun: true,
      proposedFixCount: 0,
      proposedFixesByType: {
        delete_orphan_edge_missing_from_snapshot: 0,
        delete_orphan_edge_missing_to_snapshot: 0,
        delete_orphan_scenario_revision_missing_draft: 0,
      },
      proposals: [],
    });
  });

  it.each(matrix)("returns 403 when access gate denies: $name", async ({ invoke }) => {
    requireTwinApiAccessMock.mockResolvedValue(denied);
    requireTwinMaintenanceAccessMock.mockResolvedValue(denied);

    const response = await invoke();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: denied.denied.error });
  });

  it.each(matrix)("proceeds past permission gate when allowed: $name", async ({ invoke, expectAllowedStatus }) => {
    requireTwinApiAccessMock.mockResolvedValue(accessOk);
    requireTwinMaintenanceAccessMock.mockResolvedValue(accessOk);

    const response = await invoke();
    expect(response.status).toBe(expectAllowedStatus);
  });
});
