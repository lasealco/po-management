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

describe("GET /api/supply-chain-twin/events/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([]);
  });

  it("returns 400 for invalid format", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=xml"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid format. Use `json` or `csv`.",
      code: "FORMAT_INVALID",
    });
  });

  it("returns 400 with QUERY_VALIDATION_FAILED when base events query is invalid", async () => {
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
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?limit=101"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "QUERY_VALIDATION_FAILED",
    });
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns JSON export and reuses filter query", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([
      {
        id: "e1",
        type: "entity_upsert",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        payloadJson: { k: 1 },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/supply-chain-twin/events/export?format=json&type=entity_*&since=2026-01-01T00:00:00.000Z&until=2026-01-02T00:00:00.000Z",
      ),
    );
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
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { startsWith: "entity_" },
        }),
      }),
    );
  });

  it("prefers type over legacy eventType when both are present", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/supply-chain-twin/events/export?format=json&type=entity_*&eventType=legacy"),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { startsWith: "entity_" },
        }),
      }),
    );
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { equals: "legacy" },
        }),
      }),
    );
  });

  it("returns CSV export", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([
      {
        id: "e1",
        type: "entity_upsert",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        payloadJson: { msg: "hello,world" },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=csv"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const text = await response.text();
    expect(text).toContain("id,type,createdAt,payload");
    expect(text).toContain('"{""msg"":""hello,world""}"');
  });

  it("redacts sensitive payload fields in export output", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([
      {
        id: "e1",
        type: "risk_signal",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        payloadJson: {
          token: "secret-value",
          nested: { apiKey: "abc", safe: "ok" },
        },
      },
    ]);

    const { GET } = await import("./route");
    const jsonResponse = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=json"));
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual({
      events: [
        {
          id: "e1",
          type: "risk_signal",
          createdAt: "2026-01-01T00:00:00.000Z",
          payload: {
            token: "[REDACTED]",
            nested: { apiKey: "[REDACTED]", safe: "ok" },
          },
        },
      ],
    });

    const csvResponse = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=csv"));
    expect(csvResponse.status).toBe(200);
    const csv = await csvResponse.text();
    expect(csv).toContain('"{""token"":""[REDACTED]"",""nested"":{""apiKey"":""[REDACTED]"",""safe"":""ok""}}"');
    expect(csv).not.toContain("secret-value");
  });

  it("returns 400 when export row cap is exceeded", async () => {
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
    const many = Array.from({ length: 1001 }, (_, i) => ({
      id: `e${i}`,
      type: "entity_upsert",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      payloadJson: {},
    }));
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue(many);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events/export"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Export result exceeds 1000 rows. Narrow filters and try again.",
      code: "EXPORT_ROW_CAP_EXCEEDED",
    });
  });

  it("retries transient export read failures and reaches success", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany)
      .mockRejectedValueOnce(new Error("ECONNRESET: temporary failure"))
      .mockResolvedValueOnce([
        {
          id: "e1",
          type: "entity_upsert",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          payloadJson: {},
        },
      ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=json"));
    expect(response.status).toBe(200);
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({
      events: [{ id: "e1", type: "entity_upsert", createdAt: "2026-01-01T00:00:00.000Z", payload: {} }],
    });
  });

  it("returns 500 after retry exhaustion (terminal failure state)", async () => {
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
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockRejectedValue(
      new Error("connection timeout during export read"),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/supply-chain-twin/events/export?format=json"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error", code: "UNHANDLED" });
    expect(prismaMock.supplyChainTwinIngestEvent.findMany).toHaveBeenCalledTimes(2);
  });
});
