import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    supplyChainTwinIngestEvent: {
      findMany: vi.fn(),
    },
  },
}));

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

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

/**
 * This route follows the twin demo gate: missing / ineligible session returns **403** (not 401),
 * consistent with `GET /api/supply-chain-twin/entities`.
 */
describe("GET /api/supply-chain-twin/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([]);
  });

  it("returns 403 when there is no demo user (demo gate; not 401)", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events"));

    expect(response.status).toBe(403);
  });

  it("returns 403 when Supply Chain Twin is not visible for the session", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events"));

    expect(response.status).toBe(403);
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events?limit=101"));

    expect(response.status).toBe(400);
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events?cursor=@@@"));

    expect(response.status).toBe(400);
  });

  it("returns 200 with events when authorized", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([
      {
        id: "e1",
        type: "entity_upsert",
        createdAt,
        payloadJson: { k: 1 },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events?limit=10"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        {
          id: "e1",
          type: "entity_upsert",
          createdAt: "2026-01-01T00:00:00.000Z",
          payload: { k: 1 },
        },
      ],
    });
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).toHaveBeenCalled();
  });
});
