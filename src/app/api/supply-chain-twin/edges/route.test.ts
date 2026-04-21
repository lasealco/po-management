import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const listEdgesForTenantMock = vi.fn();
const listEdgesForEntityMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/edges-repo", () => ({
  listEdgesForTenant: listEdgesForTenantMock,
  listEdgesForEntity: listEdgesForEntityMock,
}));

describe("GET /api/supply-chain-twin/edges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    listEdgesForTenantMock.mockResolvedValue([]);
    listEdgesForEntityMock.mockResolvedValue([]);
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/edges"));

    expect(response.status).toBe(403);
  });

  it("returns 400 when snapshotId is combined with fromSnapshotId", async () => {
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

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/supply-chain-twin/edges?snapshotId=abc123&fromSnapshotId=def456",
      ),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when take is out of range", async () => {
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

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/edges?take=501"));

    expect(response.status).toBe(400);
  });

  it("returns edges from listEdgesForTenant when authorized", async () => {
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
    listEdgesForTenantMock.mockResolvedValue([
      {
        id: "e1",
        relation: null,
        from: { kind: "supplier", id: "S" },
        to: { kind: "site", id: "W" },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/edges?fromSnapshotId=snap1&take=10"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      edges: [
        {
          id: "e1",
          relation: null,
          from: { kind: "supplier", id: "S" },
          to: { kind: "site", id: "W" },
        },
      ],
    });
    expect(listEdgesForTenantMock).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        fromSnapshotId: "snap1",
        take: 10,
      }),
    );
    expect(listEdgesForEntityMock).not.toHaveBeenCalled();
  });

  it("returns edges from listEdgesForEntity when snapshotId is set", async () => {
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
    listEdgesForEntityMock.mockResolvedValue([]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/edges?snapshotId=node1&direction=out"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ edges: [] });
    expect(listEdgesForEntityMock).toHaveBeenCalledWith("t1", "node1", { direction: "out", take: 200 });
    expect(listEdgesForTenantMock).not.toHaveBeenCalled();
  });
});
