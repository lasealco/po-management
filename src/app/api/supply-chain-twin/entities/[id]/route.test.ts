import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getEntitySnapshotByIdForTenantMock = vi.fn();

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

describe("GET /api/supply-chain-twin/entities/[id]", () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities/x"), {
      params: Promise.resolve({ id: "x" }),
    });

    expect(response.status).toBe(403);
    expect(getEntitySnapshotByIdForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 400 when id is empty after trim", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities/%20"), {
      params: Promise.resolve({ id: "   " }),
    });

    expect(response.status).toBe(400);
    expect(getEntitySnapshotByIdForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 404 when snapshot is missing for tenant", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities/missing-id"), {
      params: Promise.resolve({ id: "missing-id" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found.", code: "NOT_FOUND" });
    expect(getEntitySnapshotByIdForTenantMock).toHaveBeenCalledWith("t1", "missing-id");
  });

  it("returns 200 with snapshot detail when found", async () => {
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
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");
    getEntitySnapshotByIdForTenantMock.mockResolvedValue({
      id: "snap1",
      ref: { kind: "supplier", id: "ACME" },
      createdAt,
      updatedAt,
      payload: { label: "Demo" },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities/snap1"), {
      params: Promise.resolve({ id: "snap1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "snap1",
      ref: { kind: "supplier", id: "ACME" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      payload: { label: "Demo" },
    });
  });
});
