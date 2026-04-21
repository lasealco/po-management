import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();
const duplicateScenarioDraftForTenantMock = vi.fn();

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
  duplicateScenarioDraftForTenant: duplicateScenarioDraftForTenantMock,
}));

describe("POST /api/supply-chain-twin/scenarios/[id]/duplicate", () => {
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

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios/d1/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );

    expect(response.status).toBe(403);
    expect(duplicateScenarioDraftForTenantMock).not.toHaveBeenCalled();
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
      new Request("http://localhost/api/supply-chain-twin/scenarios/d1/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/valid JSON/i) });
    expect(duplicateScenarioDraftForTenantMock).not.toHaveBeenCalled();
  });

  it("returns 404 when source draft is missing for tenant (cross-tenant safe)", async () => {
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
    duplicateScenarioDraftForTenantMock.mockResolvedValue(null);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios/other-tenant-draft/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "other-tenant-draft" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
    expect(duplicateScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "other-tenant-draft", {});
  });

  it("returns 201 with a new id and passes titleSuffix to the repo", async () => {
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
    const updatedAt = new Date("2026-02-10T12:00:00.000Z");
    duplicateScenarioDraftForTenantMock.mockResolvedValue({
      id: "new-draft-id",
      title: "Stress (copy)",
      status: "draft",
      updatedAt,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios/src-draft/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleSuffix: " (copy)" }),
      }),
      { params: Promise.resolve({ id: "src-draft" }) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "new-draft-id",
      title: "Stress (copy)",
      status: "draft",
      updatedAt: "2026-02-10T12:00:00.000Z",
    });
    expect(duplicateScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "src-draft", { titleSuffix: " (copy)" });
  });

  it("returns 201 with empty object body", async () => {
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
    const updatedAt = new Date("2026-02-11T00:00:00.000Z");
    duplicateScenarioDraftForTenantMock.mockResolvedValue({
      id: "clone-2",
      title: "Same title",
      status: "draft",
      updatedAt,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/scenarios/a/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "a" }) },
    );

    expect(response.status).toBe(201);
    expect(duplicateScenarioDraftForTenantMock).toHaveBeenCalledWith("t1", "a", {});
  });
});
