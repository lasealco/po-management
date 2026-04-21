import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const createScenarioDraftMock = vi.fn();
const listScenarioDraftsForTenantPageMock = vi.fn();
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

vi.mock("@/lib/supply-chain-twin/scenarios-draft-repo", () => ({
  createScenarioDraft: createScenarioDraftMock,
  listScenarioDraftsForTenantPage: listScenarioDraftsForTenantPageMock,
}));

describe("POST /api/supply-chain-twin/scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    listScenarioDraftsForTenantPageMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: {} }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createScenarioDraftMock).not.toHaveBeenCalled();
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

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: {} }),
      }),
    );

    expect(response.status).toBe(403);
    expect(createScenarioDraftMock).not.toHaveBeenCalled();
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

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/valid JSON/i) });
    expect(createScenarioDraftMock).not.toHaveBeenCalled();
  });

  it("returns 400 when draft is missing", async () => {
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

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Only title" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createScenarioDraftMock).not.toHaveBeenCalled();
  });

  it("returns 400 when draft JSON exceeds byte cap", async () => {
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

    const huge = "x".repeat(70_000);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: { huge } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createScenarioDraftMock).not.toHaveBeenCalled();
  });

  it("returns 201 and persists when body is valid", async () => {
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
    const updatedAt = new Date("2026-02-01T12:00:00.000Z");
    createScenarioDraftMock.mockResolvedValue({
      id: "draft1",
      title: "My scenario",
      status: "draft",
      updatedAt,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My scenario", draft: { shocks: [] } }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "draft1",
      title: "My scenario",
      status: "draft",
      updatedAt: "2026-02-01T12:00:00.000Z",
    });
    expect(createScenarioDraftMock).toHaveBeenCalledWith("t1", {
      title: "My scenario",
      draft: { shocks: [] },
    });
  });
});

describe("GET /api/supply-chain-twin/scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    listScenarioDraftsForTenantPageMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios"));

    expect(response.status).toBe(403);
    expect(listScenarioDraftsForTenantPageMock).not.toHaveBeenCalled();
  });

  it("returns 403 for supplier portal sessions before list logic", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: Supply Chain Twin is not available for supplier portal sessions.",
    });
    expect(resolveNavStateMock).not.toHaveBeenCalled();
    expect(listScenarioDraftsForTenantPageMock).not.toHaveBeenCalled();
  });

  it("returns 200 with empty items when repo returns no rows", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(listScenarioDraftsForTenantPageMock).toHaveBeenCalledWith("t1", {
      limit: 50,
      cursorPosition: null,
    });
  });

  it("returns 400 when limit exceeds cap", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios?limit=101"));

    expect(response.status).toBe(400);
    expect(listScenarioDraftsForTenantPageMock).not.toHaveBeenCalled();
  });

  it("returns 400 when cursor is invalid", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios?cursor=bad"));

    expect(response.status).toBe(400);
    expect(listScenarioDraftsForTenantPageMock).not.toHaveBeenCalled();
  });

  it("returns items and nextCursor when repo reports a next page", async () => {
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
    const t1 = new Date("2026-01-10T00:00:00.000Z");
    listScenarioDraftsForTenantPageMock.mockResolvedValue({
      items: [
        { id: "a", title: "One", status: "draft", updatedAt: t1 },
        { id: "b", title: null, status: "draft", updatedAt: new Date("2026-01-09T00:00:00.000Z") },
      ],
      nextCursor: "next-page-token",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/scenarios?limit=2"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        { id: "a", title: "One", status: "draft", updatedAt: "2026-01-10T00:00:00.000Z" },
        { id: "b", title: null, status: "draft", updatedAt: "2026-01-09T00:00:00.000Z" },
      ],
      nextCursor: "next-page-token",
    });
    expect(listScenarioDraftsForTenantPageMock).toHaveBeenCalledWith("t1", {
      limit: 2,
      cursorPosition: null,
    });
  });
});
