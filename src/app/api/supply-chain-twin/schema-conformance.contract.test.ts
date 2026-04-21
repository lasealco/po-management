import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTwinApiAccessMock = vi.fn();
const listForTenantPageMock = vi.fn();
const listEdgesForTenantMock = vi.fn();
const listEdgesForEntityMock = vi.fn();
const listRiskSignalsForTenantPageMock = vi.fn();
const listScenarioDraftsForTenantPageMock = vi.fn();
const getScenarioDraftByIdForTenantMock = vi.fn();
const getTwinCatalogMetricsForTenantMock = vi.fn();

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinIngestEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supply-chain-twin/sctwin-api-access", () => ({
  requireTwinApiAccess: requireTwinApiAccessMock,
}));

vi.mock("@/lib/supply-chain-twin/repo", () => ({
  listForTenantPage: listForTenantPageMock,
}));

vi.mock("@/lib/supply-chain-twin/edges-repo", () => ({
  listEdgesForTenant: listEdgesForTenantMock,
  listEdgesForEntity: listEdgesForEntityMock,
}));

vi.mock("@/lib/supply-chain-twin/risk-signals-repo", () => ({
  listRiskSignalsForTenantPage: listRiskSignalsForTenantPageMock,
}));

vi.mock("@/lib/supply-chain-twin/scenarios-draft-repo", () => ({
  listScenarioDraftsForTenantPage: listScenarioDraftsForTenantPageMock,
  getScenarioDraftByIdForTenant: getScenarioDraftByIdForTenantMock,
}));

vi.mock("@/lib/supply-chain-twin/twin-catalog-metrics", () => ({
  getTwinCatalogMetricsForTenant: getTwinCatalogMetricsForTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  twinCatalogMetricsResponseSchema,
  twinEdgesListResponseSchema,
  twinEntitiesListResponseSchema,
  twinEventsListResponseSchema,
  twinRiskSignalsListResponseSchema,
  twinScenarioDraftDetailResponseSchema,
  twinScenariosListResponseSchema,
} from "@/lib/supply-chain-twin/schemas/twin-api-responses";

describe("Supply Chain Twin API schema conformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTwinApiAccessMock.mockResolvedValue({
      ok: true,
      access: { tenant: { id: "t1", slug: "demo-company", name: "Demo Co" } },
    });
  });

  it("parses entities list response with schema", async () => {
    listForTenantPageMock.mockResolvedValue({
      items: [{ id: "snap_1", ref: { kind: "supplier", id: "SUP-001" } }],
      nextCursor: null,
    });
    const { GET } = await import("./entities/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/entities?fields=summary&limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinEntitiesListResponseSchema.parse(body)).not.toThrow();
  });

  it("parses edges list response with schema", async () => {
    listEdgesForTenantMock.mockResolvedValue([
      {
        id: "edge_1",
        relation: "ships_to",
        from: { kind: "supplier", id: "SUP-001" },
        to: { kind: "warehouse", id: "WH-001" },
      },
    ]);
    const { GET } = await import("./edges/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/edges?take=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinEdgesListResponseSchema.parse(body)).not.toThrow();
  });

  it("parses events list response with schema", async () => {
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([
      {
        id: "evt_1",
        type: "entity_upsert",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        payloadJson: { source: "seed" },
      },
    ]);
    const { GET } = await import("./events/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/events?limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinEventsListResponseSchema.parse(body)).not.toThrow();
  });

  it("parses metrics response with schema", async () => {
    getTwinCatalogMetricsForTenantMock.mockResolvedValue({
      entities: 2,
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
        warehouse: 1,
        unknown: 0,
        other: 0,
      },
    });
    const { GET } = await import("./metrics/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/metrics"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinCatalogMetricsResponseSchema.parse(body)).not.toThrow();
  });

  it("parses risk-signals list response with schema", async () => {
    listRiskSignalsForTenantPageMock.mockResolvedValue({
      items: [
        {
          id: "risk_1",
          code: "DELAY",
          severity: "HIGH",
          title: "Delay detected",
          detail: "Synthetic detail",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      nextCursor: null,
    });
    const { GET } = await import("./risk-signals/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals?limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinRiskSignalsListResponseSchema.parse(body)).not.toThrow();
  });

  it("parses scenarios list response with schema", async () => {
    listScenarioDraftsForTenantPageMock.mockResolvedValue({
      items: [{ id: "scn_1", title: "Scenario A", status: "draft", updatedAt: new Date("2026-01-01T00:00:00.000Z") }],
      nextCursor: null,
    });
    const { GET } = await import("./scenarios/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios?limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinScenariosListResponseSchema.parse(body)).not.toThrow();
  });

  it("parses scenario detail response with schema", async () => {
    getScenarioDraftByIdForTenantMock.mockResolvedValue({
      id: "scn_1",
      title: "Scenario A",
      status: "draft",
      draftJson: { shocks: [] },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const { GET } = await import("./scenarios/[id]/route");
    const res = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/scn_1"), {
      params: Promise.resolve({ id: "scn_1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(() => twinScenarioDraftDetailResponseSchema.parse(body)).not.toThrow();
  });
});
