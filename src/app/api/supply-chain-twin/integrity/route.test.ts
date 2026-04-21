import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getTwinIntegritySummaryForTenantMock = vi.fn();

vi.mock("@/lib/authz", async () => {
  const mod = await vi.importActual<typeof import("@/lib/authz")>("@/lib/authz");
  return {
    ...mod,
    getViewerGrantSet: getViewerGrantSetMock,
    actorIsSupplierPortalRestricted: actorIsSupplierPortalRestrictedMock,
  };
});

vi.mock("@/lib/nav-visibility", () => ({
  resolveNavState: resolveNavStateMock,
}));

vi.mock("@/lib/supply-chain-twin/integrity-checker", () => ({
  getTwinIntegritySummaryForTenant: getTwinIntegritySummaryForTenantMock,
}));

describe("GET /api/supply-chain-twin/integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/integrity"));

    expect(response.status).toBe(403);
    expect(getTwinIntegritySummaryForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 200 with summary counts", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: true },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });
    getTwinIntegritySummaryForTenantMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "t1",
      ok: false,
      totals: {
        entitySnapshots: 12,
        edges: 9,
        scenarioDrafts: 3,
        scenarioRevisions: 5,
        riskSignals: 4,
      },
      issues: {
        orphanEdgeFromSnapshotRefs: 1,
        orphanEdgeToSnapshotRefs: 2,
        orphanScenarioRevisionRefs: 1,
        inconsistentRiskSignalAckMetadata: 2,
      },
      invalidReferenceCount: 6,
      samples: {
        orphanEdgeFromSnapshotEdgeIds: ["edge-1"],
        orphanEdgeToSnapshotEdgeIds: ["edge-2", "edge-3"],
        orphanScenarioRevisionIds: ["rev-1"],
        inconsistentRiskSignalIds: ["risk-1", "risk-2"],
      },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/integrity"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "t1",
      ok: false,
      totals: {
        entitySnapshots: 12,
        edges: 9,
        scenarioDrafts: 3,
        scenarioRevisions: 5,
        riskSignals: 4,
      },
      issues: {
        orphanEdgeFromSnapshotRefs: 1,
        orphanEdgeToSnapshotRefs: 2,
        orphanScenarioRevisionRefs: 1,
        inconsistentRiskSignalAckMetadata: 2,
      },
      invalidReferenceCount: 6,
      samples: {
        orphanEdgeFromSnapshotEdgeIds: ["edge-1"],
        orphanEdgeToSnapshotEdgeIds: ["edge-2", "edge-3"],
        orphanScenarioRevisionIds: ["rev-1"],
        inconsistentRiskSignalIds: ["risk-1", "risk-2"],
      },
    });
    expect(getTwinIntegritySummaryForTenantMock).toHaveBeenCalledWith("t1");
  });
});
