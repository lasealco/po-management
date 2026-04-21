import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const listForTenantMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  getViewerGrantSet: getViewerGrantSetMock,
}));

vi.mock("@/lib/nav-visibility", () => ({
  resolveNavState: resolveNavStateMock,
}));

vi.mock("@/lib/supply-chain-twin/repo", () => ({
  listForTenant: listForTenantMock,
}));

describe("Supply Chain Twin entities route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listForTenantMock.mockResolvedValue([]);
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
    expect(listForTenantMock).toHaveBeenCalledWith("t1", { q: "test" });
  });

  it("returns rows from listForTenant", async () => {
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
    listForTenantMock.mockResolvedValue([{ ref: { kind: "supplier", id: "ACME" } }]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/entities"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ ref: { kind: "supplier", id: "ACME" } }],
    });
  });
});
