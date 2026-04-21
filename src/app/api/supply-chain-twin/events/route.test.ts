import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewerGrantSetMock = vi.fn();
const resolveNavStateMock = vi.fn();
const actorIsSupplierPortalRestrictedMock = vi.fn();

const appendIngestEventMock = vi.fn();

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

vi.mock("@/lib/supply-chain-twin/ingest-writer", async () => {
  const mod = await vi.importActual<typeof import("@/lib/supply-chain-twin/ingest-writer")>(
    "@/lib/supply-chain-twin/ingest-writer",
  );
  return {
    ...mod,
    appendIngestEvent: appendIngestEventMock,
  };
});

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
    appendIngestEventMock.mockReset();
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

describe("POST /api/supply-chain-twin/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorIsSupplierPortalRestrictedMock.mockResolvedValue(false);
    vi.mocked(prismaMock.supplyChainTwinIngestEvent.findMany).mockResolvedValue([]);
    appendIngestEventMock.mockReset();
  });

  it("returns 403 when there is no demo user", async () => {
    getViewerGrantSetMock.mockResolvedValue({
      tenant: { id: "t1", name: "Demo", slug: "demo-company" },
      user: null,
      grantSet: new Set(),
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "x", payload: {} }),
      }),
    );

    expect(response.status).toBe(403);
    expect(appendIngestEventMock).not.toHaveBeenCalled();
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
      new Request("http://localhost/api/supply-chain-twin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/valid JSON/i) });
    expect(appendIngestEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when payload exceeds cap (Zod)", async () => {
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
    const { TWIN_INGEST_MAX_PAYLOAD_BYTES } = await import("@/lib/supply-chain-twin/ingest-writer");
    const huge = "z".repeat(TWIN_INGEST_MAX_PAYLOAD_BYTES + 20);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "blob", payload: { data: huge } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Ingest payload exceeds maximum size.",
      code: "TWIN_INGEST_PAYLOAD_TOO_LARGE",
    });
    expect(appendIngestEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when writer rejects oversize", async () => {
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
    const { TwinIngestPayloadTooLargeError } = await import("@/lib/supply-chain-twin/ingest-writer");
    appendIngestEventMock.mockRejectedValue(new TwinIngestPayloadTooLargeError());

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ok", payload: { n: 1 } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "TWIN_INGEST_PAYLOAD_TOO_LARGE",
    });
  });

  it("returns 201 and calls appendIngestEvent when body is valid", async () => {
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
    appendIngestEventMock.mockResolvedValue({ id: "evt-new" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/supply-chain-twin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "  manual.append  ", payload: { source: "test" } }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "evt-new", type: "manual.append" });
    expect(appendIngestEventMock).toHaveBeenCalledWith({
      tenantId: "t1",
      type: "manual.append",
      payload: { source: "test" },
    });
  });
});
