import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const listRiskSignalsForTenantPageMock = vi.fn();
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

vi.mock("@/lib/supply-chain-twin/risk-signals-repo", () => ({
  listRiskSignalsForTenantPage: listRiskSignalsForTenantPageMock,
}));

describe("GET /api/supply-chain-twin/risk-signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    listRiskSignalsForTenantPageMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals"));

    expect(response.status).toBe(403);
    expect(listRiskSignalsForTenantPageMock).not.toHaveBeenCalled();
  });

  it("returns 403 for supplier portal sessions before repo logic", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: Supply Chain Twin is not available for supplier portal sessions.",
    });
    expect(resolveNavStateMock).not.toHaveBeenCalled();
    expect(listRiskSignalsForTenantPageMock).not.toHaveBeenCalled();
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(listRiskSignalsForTenantPageMock).toHaveBeenCalledWith("t1", {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals?limit=101"));

    expect(response.status).toBe(400);
    expect(listRiskSignalsForTenantPageMock).not.toHaveBeenCalled();
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals?cursor=bad"));

    expect(response.status).toBe(400);
    expect(listRiskSignalsForTenantPageMock).not.toHaveBeenCalled();
  });

  it("passes severity filter to repo when valid", async () => {
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
      new Request("http://localhost/api/supply-chain-twin/risk-signals?severity=HIGH&limit=10"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(listRiskSignalsForTenantPageMock).toHaveBeenCalledWith("t1", {
      limit: 10,
      cursorPosition: null,
      severity: "HIGH",
    });
  });

  it("returns items and optional nextCursor", async () => {
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
    const t0 = new Date("2026-04-10T10:00:00.000Z");
    const t1 = new Date("2026-04-10T09:00:00.000Z");
    listRiskSignalsForTenantPageMock.mockResolvedValue({
      items: [
        {
          id: "r1",
          code: "DEMO-R1",
          severity: "MEDIUM" as const,
          title: "Demo risk title",
          detail: "Operator context only.",
          createdAt: t0,
          updatedAt: t0,
        },
        {
          id: "r2",
          code: "DEMO-R2",
          severity: "LOW" as const,
          title: "Second signal",
          detail: null,
          createdAt: t1,
          updatedAt: t1,
        },
      ],
      nextCursor: "next-cursor-token",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/risk-signals?limit=2"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: "r1",
          code: "DEMO-R1",
          severity: "MEDIUM",
          title: "Demo risk title",
          detail: "Operator context only.",
          createdAt: "2026-04-10T10:00:00.000Z",
          updatedAt: "2026-04-10T10:00:00.000Z",
        },
        {
          id: "r2",
          code: "DEMO-R2",
          severity: "LOW",
          title: "Second signal",
          detail: null,
          createdAt: "2026-04-10T09:00:00.000Z",
          updatedAt: "2026-04-10T09:00:00.000Z",
        },
      ],
      nextCursor: "next-cursor-token",
    });
  });
});
