import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const getScenarioDraftByIdForTenantMock = vi.fn();
const patchScenarioDraftForTenantMock = vi.fn();
const deleteScenarioDraftForTenantMock = vi.fn();

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
  patchScenarioDraftForTenant: patchScenarioDraftForTenantMock,
  deleteScenarioDraftForTenant: deleteScenarioDraftForTenantMock,
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

describe("PATCH /api/supply-chain-twin/scenarios/[id]", () => {
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

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/d1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );

    expect(response.status).toBe(403);
    expect(patchScenarioDraftForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not valid JSON", async () => {
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

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/d1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/valid JSON/i) });
    expect(patchScenarioDraftForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 400 when patch is empty", async () => {
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

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/d1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );

    expect(response.status).toBe(400);
    expect(patchScenarioDraftForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 404 when repo reports no row", async () => {
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
    patchScenarioDraftForTenantMock.mockResolvedValue({ ok: false, reason: "not_found" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Only title" }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(patchScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "missing", { title: "Only title" });
  });

  it("returns 400 when repo rejects a status transition", async () => {
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
    patchScenarioDraftForTenantMock.mockResolvedValue({
      ok: false,
      reason: "invalid_status_transition",
      message: "Cannot set status to draft unless the scenario is archived or already draft.",
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/draft1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      }),
      { params: Promise.resolve({ id: "draft1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Cannot set status to draft unless the scenario is archived or already draft.",
    });
  });

  it("returns 200 for status-only patch", async () => {
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
    const updatedAt = new Date("2026-01-06T00:00:00.000Z");
    patchScenarioDraftForTenantMock.mockResolvedValue({
      ok: true,
      row: {
        id: "draft1",
        title: "Keep",
        status: "archived",
        draftJson: { shocks: [] },
        createdAt,
        updatedAt,
      },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/draft1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      }),
      { params: Promise.resolve({ id: "draft1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "draft1",
      title: "Keep",
      status: "archived",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-06T00:00:00.000Z",
      draft: { shocks: [] },
    });
    expect(patchScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "draft1", { status: "archived" });
  });

  it("returns 200 with full detail after patch", async () => {
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
    const updatedAt = new Date("2026-01-05T12:00:00.000Z");
    patchScenarioDraftForTenantMock.mockResolvedValue({
      ok: true,
      row: {
        id: "draft1",
        title: "Renamed",
        status: "draft",
        draftJson: { shocks: [] },
        createdAt,
        updatedAt,
      },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/supply-chain-twin/scenarios/draft1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed", draft: { shocks: [] } }),
      }),
      { params: Promise.resolve({ id: "draft1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "draft1",
      title: "Renamed",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-05T12:00:00.000Z",
      draft: { shocks: [] },
    });
    expect(patchScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "draft1", {
      title: "Renamed",
      draft: { shocks: [] },
    });
  });
});

describe("DELETE /api/supply-chain-twin/scenarios/[id]", () => {
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

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/supply-chain-twin/scenarios/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });

    expect(response.status).toBe(403);
    expect(deleteScenarioDraftForTenantMock).not.toHaveBeenCalled();
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

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/supply-chain-twin/scenarios/%20"), {
      params: Promise.resolve({ id: "   " }),
    });

    expect(response.status).toBe(400);
    expect(deleteScenarioDraftForTenantMock).not.toHaveBeenCalled();
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
    deleteScenarioDraftForTenantMock.mockResolvedValue(false);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/supply-chain-twin/scenarios/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
    expect(deleteScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "missing");
  });

  it("returns 204 when delete succeeds", async () => {
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
    deleteScenarioDraftForTenantMock.mockResolvedValue(true);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost/api/supply-chain-twin/scenarios/draft1"), {
      params: Promise.resolve({ id: "draft1" }),
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "draft1");
  });
});
