import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getTwinIntegrityRepairDryRunForTenantMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/integrity-repair-dry-run", () => ({
  getTwinIntegrityRepairDryRunForTenant: getTwinIntegrityRepairDryRunForTenantMock,
}));

describe("GET /api/supply-chain-twin/integrity/repair-dry-run", () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/integrity/repair-dry-run"));

    expect(response.status).toBe(403);
    expect(getTwinIntegrityRepairDryRunForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 200 with machine-readable dry-run proposal summary", async () => {
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
    getTwinIntegrityRepairDryRunForTenantMock.mockResolvedValue({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "t1",
      dryRun: true,
      proposedFixCount: 2,
      proposedFixesByType: {
        delete_orphan_edge_missing_from_snapshot: 1,
        delete_orphan_edge_missing_to_snapshot: 0,
        delete_orphan_scenario_revision_missing_draft: 1,
      },
      proposals: [
        {
          action: "delete_orphan_edge_missing_from_snapshot",
          targetId: "edge-1",
          reason: "fromSnapshotId snap-missing-a does not exist in tenant scope.",
        },
        {
          action: "delete_orphan_scenario_revision_missing_draft",
          targetId: "rev-1",
          reason: "scenarioDraftId draft-missing-a does not exist in tenant scope.",
        },
      ],
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/integrity/repair-dry-run"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checkedAt: "2026-01-01T00:00:00.000Z",
      tenantId: "t1",
      dryRun: true,
      proposedFixCount: 2,
      proposedFixesByType: {
        delete_orphan_edge_missing_from_snapshot: 1,
        delete_orphan_edge_missing_to_snapshot: 0,
        delete_orphan_scenario_revision_missing_draft: 1,
      },
      proposals: [
        {
          action: "delete_orphan_edge_missing_from_snapshot",
          targetId: "edge-1",
          reason: "fromSnapshotId snap-missing-a does not exist in tenant scope.",
        },
        {
          action: "delete_orphan_scenario_revision_missing_draft",
          targetId: "rev-1",
          reason: "scenarioDraftId draft-missing-a does not exist in tenant scope.",
        },
      ],
    });
    expect(getTwinIntegrityRepairDryRunForTenantMock).toHaveBeenCalledWith("t1");
  });
});
