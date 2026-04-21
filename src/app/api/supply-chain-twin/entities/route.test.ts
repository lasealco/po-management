import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const listForTenantPageMock = vi.fn();
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

vi.mock("@/lib/supply-chain-twin/repo", () => ({
  listForTenantPage: listForTenantPageMock,
}));

describe("Supply Chain Twin entities route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    listForTenantPageMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("returns 403 for supplier portal sessions before catalog logic", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: { id: "u1", email: "x@y.com", name: "X" },
      grantSet: new Set(),
    });
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(true);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: Supply Chain Twin is not available for supplier portal sessions.",
    });
    expect(resolveNavStateMock).not.toHaveBeenCalled();
    expect(listForTenantPageMock).not.toHaveBeenCalled();
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities"));

    expect(response.status).toBe(403);
  });

  it("returns 400 when query fails zod validation", async () => {
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

    const longQ = "x".repeat(300);
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/supply-chain-twin/entities?q=${encodeURIComponent(longQ)}`),
    );

    expect(response.status).toBe(400);
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities?limit=101"));

    expect(response.status).toBe(400);
  });

  it("returns 400 when entityKind is not in allowlist", async () => {
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
      new Request("http://localhost/api/supply-chain-twin/entities?entityKind=invalid_kind_xyz"),
    );

    expect(response.status).toBe(400);
    expect(listForTenantPageMock).not.toHaveBeenCalled();
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities?cursor=not-a-cursor"));

    expect(response.status).toBe(400);
  });

  it("returns 200 with empty items when authorized", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities?q=test"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(listForTenantPageMock).toHaveBeenCalledWith("t1", { q: "test", limit: 100, cursor: null });
  });

  it("passes entityKind with q to listForTenantPage", async () => {
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
      new Request("http://localhost/api/supply-chain-twin/entities?q=acme&entityKind=supplier"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(listForTenantPageMock).toHaveBeenCalledWith("t1", {
      q: "acme",
      limit: 100,
      cursor: null,
      entityKind: "supplier",
    });
  });

  it("returns rows and optional nextCursor from listForTenantPage", async () => {
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
    listForTenantPageMock.mockResolvedValue({
      items: [{ id: "snap-acme", ref: { kind: "supplier", id: "ACME" } }],
      nextCursor: "next-page-token",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities?limit=10"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: "snap-acme", ref: { kind: "supplier", id: "ACME" } }],
      nextCursor: "next-page-token",
    });
    expect(listForTenantPageMock).toHaveBeenCalledWith("t1", { q: "", limit: 10, cursor: null });
  });
});
