import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const listScenarioHistoryForTenantMock = vi.fn();

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
  listScenarioHistoryForTenant: listScenarioHistoryForTenantMock,
}));

describe("GET /api/supply-chain-twin/scenarios/[id]/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
  });

  it("returns 404 when draft id is missing for tenant", async () => {
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
    listScenarioHistoryForTenantMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/missing/history"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
    expect(listScenarioHistoryForTenantMock).toHaveBeenCalledWith("t1", "missing");
  });

  it("returns metadata-only history rows without draft payloads", async () => {
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
    listScenarioHistoryForTenantMock.mockResolvedValue([
      {
        id: "rev_1",
        createdAt: new Date("2026-04-28T16:05:00.000Z"),
        actorId: "u1",
        action: "patch",
        titleBefore: "Plan A",
        titleAfter: "Plan B",
        statusBefore: "draft",
        statusAfter: "archived",
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios/d1/history"), {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: "rev_1",
          createdAt: "2026-04-28T16:05:00.000Z",
          actorId: "u1",
          action: "patch",
          titleBefore: "Plan A",
          titleAfter: "Plan B",
          statusBefore: "draft",
          statusAfter: "archived",
        },
      ],
    });
  });
});
