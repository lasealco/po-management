import { beforeEach, describe, expect, it, vi } from "vitest";

import { twinApiContractSnapshotV1 } from "./contract-snapshot-baseline.v1";

const requireTwinApiAccessMock = vi.fn();
const getSupplyChainTwinReadinessSnapshotMock = vi.fn();
const listForTenantPageMock = vi.fn();
const listRiskSignalsForTenantPageMock = vi.fn();
const listScenarioDraftsForTenantPageMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/readiness", () => ({
  getSupplyChainTwinReadinessSnapshot: getSupplyChainTwinReadinessSnapshotMock,
}));

vi.mock("@/lib/supply-chain-twin/repo", () => ({
  listForTenantPage: listForTenantPageMock,
}));

vi.mock("@/lib/supply-chain-twin/risk-signals-repo", () => ({
  listRiskSignalsForTenantPage: listRiskSignalsForTenantPageMock,
}));

vi.mock("@/lib/supply-chain-twin/scenarios-draft-repo", () => ({
  listScenarioDraftsForTenantPage: listScenarioDraftsForTenantPageMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("Supply Chain Twin API contract snapshot baseline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTwinApiAccessMock.mockResolvedValue({
      ok: true,
      access: { tenant: { id: "t1", slug: "demo-company", name: "Demo Co" } },
    });

    getSupplyChainTwinReadinessSnapshotMock.mockResolvedValue({
      ok: true,
      reasons: [],
      healthIndex: { mode: "stub", score: 72, disclaimer: "non_production" },
      hasTwinData: true,
    });

    listForTenantPageMock.mockResolvedValue({
      items: [{ id: "snap_1", ref: { kind: "supplier", id: "SUP-001" } }],
      nextCursor: null,
    });

    listScenarioDraftsForTenantPageMock.mockResolvedValue({
      items: [{ id: "scn_1", title: "Scenario A", status: "draft", updatedAt: new Date("2026-01-01T00:00:00.000Z") }],
      nextCursor: null,
    });

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

    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([
      {
        id: "evt_1",
        type: "entity_upsert",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        payloadJson: { source: "seed" },
      },
    ]);
  });

  it("matches the version-controlled v1 baseline for key endpoints", async () => {
    const { GET: readinessGET } = await import("./readiness/route");
    const { GET: entitiesGET } = await import("./entities/route");
    const { GET: scenariosGET } = await import("./scenarios/route");
    const { GET: risksGET } = await import("./risk-signals/route");
    const { GET: exportGET } = await import("./events/export/route");

    const readinessRes = await readinessGET(new Request("http://localhost/api/supply-chain-twin/readiness"));
    const entitiesRes = await entitiesGET(new Request("http://localhost/api/supply-chain-twin/entities?fields=summary&limit=1"));
    const scenariosRes = await scenariosGET(new Request("http://localhost/api/supply-chain-twin/scenarios?limit=1"));
    const risksRes = await risksGET(new Request("http://localhost/api/supply-chain-twin/risk-signals?limit=1"));
    const exportRes = await exportGET(
      new Request("http://localhost/api/supply-chain-twin/events/export?format=json&limit=1&includePayload=false"),
    );

    const actual = {
      version: "v1",
      endpoints: {
        readiness: {
          status: readinessRes.status,
          body: await readinessRes.json(),
        },
        entitiesSummary: {
          status: entitiesRes.status,
          body: await entitiesRes.json(),
        },
        scenariosList: {
          status: scenariosRes.status,
          body: await scenariosRes.json(),
        },
        riskSignalsList: {
          status: risksRes.status,
          body: await risksRes.json(),
        },
        eventsExportJson: {
          status: exportRes.status,
          body: await exportRes.json(),
        },
      },
    };

    expect(actual).toEqual(twinApiContractSnapshotV1);
  });
});
