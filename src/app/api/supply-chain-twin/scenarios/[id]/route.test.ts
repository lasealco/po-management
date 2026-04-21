import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getScenarioDraftByIdForTenantMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/scenarios-draft-repo", () => ({
  getScenarioDraftByIdForTenant: getScenarioDraftByIdForTenantMock,
}));

describe("GET /api/supply-chain-twin/scenarios/[id]", () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(403);
    expect(getScenarioDraftByIdForTenantMock).not.toHaveBeenCalled();
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/%20"), {
      params: Promise.resolve({ id: "   " }),
    });

    expect(response.status).toBe(400);
    expect(getScenarioDraftByIdForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 404 when draft is missing for tenant", async () => {
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
    getScenarioDraftByIdForTenantMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
    expect(getScenarioDraftByIdForTenantMock).toHaveBeenCalledWith("t1", "missing");
  });

  it("returns 200 with draft detail when found", async () => {
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
    getScenarioDraftByIdForTenantMock.mockResolvedValue({
      id: "draft1",
      title: "Q1 stress",
      status: "draft",
      draftJson: { shocks: [{ type: "delay", days: 3 }] },
      createdAt,
      updatedAt,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/draft1"), {
      params: Promise.resolve({ id: "draft1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "draft1",
      title: "Q1 stress",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      draft: { shocks: [{ type: "delay", days: 3 }] },
    });
  });
});
