import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTwinApiAccessMock = vi.fn();
const getSupplyChainTwinReadinessSnapshotMock = vi.fn();
const listForTenantPageMock = vi.fn();

vi.mock("@/lib/supply-chain-twin/sctwin-api-access", () => ({
  requireTwinApiAccess: requireTwinApiAccessMock,
}));

vi.mock("@/lib/supply-chain-twin/readiness", () => ({
  getSupplyChainTwinReadinessSnapshot: getSupplyChainTwinReadinessSnapshotMock,
}));

vi.mock("@/lib/supply-chain-twin/repo", () => ({
  listForTenantPage: listForTenantPageMock,
}));

describe("Supply Chain Twin request-id header parity contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listForTenantPageMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("echoes x-request-id and x-sctwin-request-id on readiness success", async () => {
    requireTwinApiAccessMock.mockResolvedValue({
      ok: true,
      access: { tenant: { id: "t1", slug: "demo-company", name: "Demo Co" } },
    });
    getSupplyChainTwinReadinessSnapshotMock.mockResolvedValue({
      ok: true,
      reasons: [],
      healthIndex: { mode: "stub", score: 72, disclaimer: "non_production" },
      hasTwinData: true,
    });

    const { GET } = await import("./readiness/route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/readiness", {
        headers: { "x-request-id": "gateway-req-2001" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("gateway-req-2001");
    expect(response.headers.get("x-sctwin-request-id")).toBe("gateway-req-2001");
  });

  it("echoes both request-id headers on readiness denied responses", async () => {
    requireTwinApiAccessMock.mockResolvedValue({
      ok: false,
      denied: {
        status: 403,
        error: "Forbidden: Supply Chain Twin is not enabled for this tenant.",
      },
    });

    const { GET } = await import("./readiness/route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/readiness", {
        headers: { "x-request-id": "gateway-req-2002" },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("gateway-req-2002");
    expect(response.headers.get("x-sctwin-request-id")).toBe("gateway-req-2002");
  });

  it("echoes both request-id headers on entities validation errors", async () => {
    requireTwinApiAccessMock.mockResolvedValue({
      ok: true,
      access: { tenant: { id: "t1", slug: "demo-company", name: "Demo Co" } },
    });

    const { GET } = await import("./entities/route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/entities?cursor=@@@", {
        headers: { "x-request-id": "gateway-req-2003" },
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("gateway-req-2003");
    expect(response.headers.get("x-sctwin-request-id")).toBe("gateway-req-2003");
  });
});
