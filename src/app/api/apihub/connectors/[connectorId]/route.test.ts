import { beforeEach, describe, expect, it, vi } from "vitest";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const updateApiHubConnectorLifecycleMock = vi.fn();
const toApiHubConnectorDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/authz", () => ({
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/apihub/connectors-repo", () => ({
  updateApiHubConnectorLifecycle: updateApiHubConnectorLifecycleMock,
}));

vi.mock("@/lib/apihub/connector-dto", () => ({
  toApiHubConnectorDto: toApiHubConnectorDtoMock,
}));

describe("PATCH /api/apihub/connectors/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid status", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("actor-1");

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/connector-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "bad-status" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ connectorId: "connector-1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "status must be one of: draft, active, paused, error.",
    });
  });

  it("returns 404 when connector is missing", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("actor-1");
    updateApiHubConnectorLifecycleMock.mockResolvedValue(null);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/connector-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "active", markSyncedNow: true, note: "  synced  " }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ connectorId: "connector-1" }) },
    );

    expect(updateApiHubConnectorLifecycleMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      connectorId: "connector-1",
      actorUserId: "actor-1",
      status: "active",
      syncNow: true,
      note: "synced",
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Connector not found." });
  });

  it("returns updated connector dto on success", async () => {
    const updatedRow = {
      id: "connector-1",
      name: "ERP feed",
      sourceKind: "stub",
      status: "paused",
      lastSyncAt: null,
      healthSummary: "Not connected",
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
      updatedAt: new Date("2026-04-20T11:00:00.000Z"),
    };
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("actor-1");
    updateApiHubConnectorLifecycleMock.mockResolvedValue(updatedRow);
    toApiHubConnectorDtoMock.mockReturnValue({ id: "dto-1", status: "paused" });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/connector-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "paused", markSyncedNow: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ connectorId: "connector-1" }) },
    );

    expect(response.status).toBe(200);
    expect(toApiHubConnectorDtoMock).toHaveBeenCalledWith(updatedRow);
    expect(await response.json()).toEqual({ connector: { id: "dto-1", status: "paused" } });
  });
});
