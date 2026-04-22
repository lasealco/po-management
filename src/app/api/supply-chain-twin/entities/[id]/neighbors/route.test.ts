import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getEntitySnapshotByIdForTenantMock = vi.fn();
const listEntityNeighborsForTenantMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/repo", async () => {
  const mod = await vi.importActual<typeof import("@/lib/supply-chain-twin/repo")>("@/lib/supply-chain-twin/repo");
  return {
    ...mod,
    getEntitySnapshotByIdForTenant: getEntitySnapshotByIdForTenantMock,
  };
});

vi.mock("@/lib/supply-chain-twin/edges-repo", async () => {
  const mod = await vi.importActual<typeof import("@/lib/supply-chain-twin/edges-repo")>("@/lib/supply-chain-twin/edges-repo");
  return {
    ...mod,
    listEntityNeighborsForTenant: listEntityNeighborsForTenantMock,
  };
});

describe("GET /api/supply-chain-twin/entities/[id]/neighbors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    listEntityNeighborsForTenantMock.mockResolvedValue([]);
  });

  it("returns 404 when entity id does not exist for tenant", async () => {
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
    getEntitySnapshotByIdForTenantMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities/missing/neighbors"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found.", code: "NOT_FOUND" });
    expect(listEntityNeighborsForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 404 for cross-tenant id (same not-found contract)", async () => {
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
    getEntitySnapshotByIdForTenantMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/entities/cross-tenant-id/neighbors"),
      {
        params: Promise.resolve({ id: "cross-tenant-id" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found.", code: "NOT_FOUND" });
  });

  it("returns 200 with empty neighbors list", async () => {
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
    getEntitySnapshotByIdForTenantMock.mockResolvedValue({
      id: "snap1",
      ref: { kind: "supplier", id: "SUP-1" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      payload: {},
    });
    listEntityNeighborsForTenantMock.mockResolvedValue([]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/entities/snap1/neighbors?direction=both"),
      {
        params: Promise.resolve({ id: "snap1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "snap1", neighbors: [] });
    expect(listEntityNeighborsForTenantMock).toHaveBeenCalledWith("t1", "snap1", {
      direction: "both",
      take: 200,
    });
  });
});
