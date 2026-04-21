import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getTwinCatalogMetricsForTenantMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/twin-catalog-metrics", () => ({
  getTwinCatalogMetricsForTenant: getTwinCatalogMetricsForTenantMock,
}));

describe("GET /api/supply-chain-twin/metrics", () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/metrics"));

    expect(response.status).toBe(403);
    expect(getTwinCatalogMetricsForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 403 for supplier portal sessions before metrics logic", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/metrics"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: Supply Chain Twin is not available for supplier portal sessions.",
    });
    expect(resolveNavStateMock).not.toHaveBeenCalled();
    expect(getTwinCatalogMetricsForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 200 with count shape for tenant", async () => {
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
    getTwinCatalogMetricsForTenantMock.mockResolvedValue({
      entities: 5,
      edges: 2,
      events: 100,
      scenarioDrafts: 3,
      riskSignals: 1,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/metrics"));

    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toMatchObject({
      entities: 5,
      edges: 2,
      events: 100,
      scenarioDrafts: 3,
      riskSignals: 1,
    });
    expect(typeof json.generatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(json.generatedAt)))).toBe(false);
    expect(getTwinCatalogMetricsForTenantMock).toHaveBeenCalledWith("t1");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("echoes a safe client x-request-id on success responses", async () => {
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
    getTwinCatalogMetricsForTenantMock.mockResolvedValue({
      entities: 0,
      edges: 0,
      events: 0,
      scenarioDrafts: 0,
      riskSignals: 0,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/metrics", {
        headers: { "x-request-id": "gateway-req-0001" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("gateway-req-0001");
  });

  it("returns 403 when twin visibility is off for the session", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    resolveNavStateMock.mockResolvedValue({
      linkVisibility: { supplyChainTwin: false },
      setupIncomplete: false,
      poSubNavVisibility: {},
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/metrics"));

    expect(response.status).toBe(403);
    expect(getTwinCatalogMetricsForTenantMock).not.toHaveBeenCalled();
  });
});
