import { beforeEach, describe, expect, it, vi } from "vitest";

import { TWIN_HEALTH_INDEX_STUB } from "@/lib/supply-chain-twin/kpi-stub";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const getSupplyChainTwinReadinessSnapshotMock = vi.fn();
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

vi.mock("@/lib/supply-chain-twin/readiness", () => ({
  getSupplyChainTwinReadinessSnapshot: getSupplyChainTwinReadinessSnapshotMock,
}));

describe("Supply Chain Twin readiness route contract", () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/readiness"));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.ok).toBeUndefined();
  });

  it("returns 403 when Twin link is not visible for this session", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/readiness"));

    expect(response.status).toBe(403);
  });

  it("returns 200 with ok and reasons when authorized", async () => {
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
    getSupplyChainTwinReadinessSnapshotMock.mockResolvedValue({
      ok: false,
      reasons: ["Twin datastore not migrated"],
      healthIndex: TWIN_HEALTH_INDEX_STUB,
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/readiness"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: false,
      reasons: ["Twin datastore not migrated"],
      healthIndex: TWIN_HEALTH_INDEX_STUB,
    });
  });

  it("passes refresh=true to bypass readiness cache", async () => {
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
    getSupplyChainTwinReadinessSnapshotMock.mockResolvedValue({
      ok: true,
      reasons: [],
      healthIndex: TWIN_HEALTH_INDEX_STUB,
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/supply-chain-twin/readiness?refresh=true"));

    expect(getSupplyChainTwinReadinessSnapshotMock).toHaveBeenCalledWith({ bypassCache: true });
  });
});
