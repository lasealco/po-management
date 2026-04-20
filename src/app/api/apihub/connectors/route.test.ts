import { beforeEach, describe, expect, it, vi } from "vitest";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listApiHubConnectorsMock = vi.fn();
const listApiHubConnectorAuditLogsMock = vi.fn();
const createStubApiHubConnectorMock = vi.fn();
const toApiHubConnectorDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/authz", () => ({
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/apihub/connectors-repo", () => ({
  listApiHubConnectors: listApiHubConnectorsMock,
  listApiHubConnectorAuditLogs: listApiHubConnectorAuditLogsMock,
  createStubApiHubConnector: createStubApiHubConnectorMock,
}));

vi.mock("@/lib/apihub/connector-dto", () => ({
  toApiHubConnectorDto: toApiHubConnectorDtoMock,
}));

describe("GET /api/apihub/connectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when demo tenant is missing", async () => {
    getDemoTenantMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Demo tenant not found. Run `npm run db:seed` to create starter data.",
    });
  });

  it("returns 403 when actor is missing", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
    });
  });

  it("returns connector rows with audit logs", async () => {
    const row = {
      id: "connector-1",
      name: "Carrier feed",
      sourceKind: "stub",
      status: "draft",
      lastSyncAt: null,
      healthSummary: "ok",
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    };
    const audit = {
      id: "audit-1",
      connectorId: "connector-1",
      actorUserId: "actor-1",
      action: "connector.created",
      note: "Created",
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
    };

    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("actor-1");
    listApiHubConnectorsMock.mockResolvedValue([row]);
    listApiHubConnectorAuditLogsMock.mockResolvedValue([audit]);
    toApiHubConnectorDtoMock.mockReturnValue({ id: "dto-1" });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(listApiHubConnectorsMock).toHaveBeenCalledWith("tenant-1");
    expect(listApiHubConnectorAuditLogsMock).toHaveBeenCalledWith("tenant-1", "connector-1", 3);
    expect(toApiHubConnectorDtoMock).toHaveBeenCalledWith(
      {
        ...row,
        auditLogs: [audit],
      },
      0,
      expect.any(Array),
    );
    expect(await response.json()).toEqual({ connectors: [{ id: "dto-1" }] });
  });
});

describe("POST /api/apihub/connectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a connector with trimmed and capped name", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("actor-1");
    createStubApiHubConnectorMock.mockResolvedValue({
      id: "connector-1",
      name: "New connector",
      sourceKind: "stub",
      status: "draft",
      lastSyncAt: null,
      healthSummary: null,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    toApiHubConnectorDtoMock.mockReturnValue({ id: "dto-1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/connectors", {
        method: "POST",
        body: JSON.stringify({ name: "   New connector   " }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    expect(createStubApiHubConnectorMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "actor-1",
      name: "New connector",
    });
    expect(await response.json()).toEqual({ connector: { id: "dto-1" } });
  });

  it("uses default name when payload is invalid json", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("actor-1");
    createStubApiHubConnectorMock.mockResolvedValue({
      id: "connector-1",
      name: "Stub connector",
      sourceKind: "stub",
      status: "draft",
      lastSyncAt: null,
      healthSummary: null,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    toApiHubConnectorDtoMock.mockReturnValue({ id: "dto-1" });

    const { POST } = await import("./route");
    await POST(
      new Request("http://localhost/api/apihub/connectors", {
        method: "POST",
        body: "{not json",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(createStubApiHubConnectorMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "actor-1",
      name: "Stub connector",
    });
  });
});
