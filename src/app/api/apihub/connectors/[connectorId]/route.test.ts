import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN } from "@/lib/apihub/constants";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubConnectorInTenantMock = vi.fn();
const updateApiHubConnectorLifecycleMock = vi.fn();
const countInFlightMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/connectors-repo", () => ({
  getApiHubConnectorInTenant: getApiHubConnectorInTenantMock,
  updateApiHubConnectorLifecycle: updateApiHubConnectorLifecycleMock,
}));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  countInFlightApiHubIngestionRunsForConnector: countInFlightMock,
}));
vi.mock("@/lib/apihub/connector-dto", () => ({
  toApiHubConnectorDto: (row: { id: string }) => ({ id: `dto-${row.id}` }),
}));

describe("PATCH /api/apihub/connectors/:connectorId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    updateApiHubConnectorLifecycleMock.mockResolvedValue({ id: "c1" });
  });

  it("returns 409 when leaving active with in-flight jobs and short note", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "active" });
    countInFlightMock.mockResolvedValue(2);
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-guard-1" },
        body: JSON.stringify({ status: "paused", note: "short" }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(409);
    expect(countInFlightMock).toHaveBeenCalledWith({ tenantId: "tenant-1", connectorId: "c1" });
    expect(updateApiHubConnectorLifecycleMock).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("ACTIVE_CONNECTOR_HAS_RUNNING_JOBS");
    expect(body.error.message).toContain(String(APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN));
  });

  it("allows leaving active with in-flight jobs when note meets minimum length", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "active" });
    countInFlightMock.mockResolvedValue(1);
    const { PATCH } = await import("./route");
    const longNote = "x".repeat(APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN);
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-guard-ok" },
        body: JSON.stringify({ status: "paused", note: longNote }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(200);
    expect(updateApiHubConnectorLifecycleMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      connectorId: "c1",
      actorUserId: "user-1",
      status: "paused",
      syncNow: false,
      note: longNote,
    });
  });

  it("skips guard when not leaving active", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "draft" });
    countInFlightMock.mockResolvedValue(5);
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-draft" },
        body: JSON.stringify({ status: "paused" }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(200);
    expect(countInFlightMock).not.toHaveBeenCalled();
    expect(updateApiHubConnectorLifecycleMock).toHaveBeenCalled();
  });

  it("skips guard when staying active", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "active" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-stay" },
        body: JSON.stringify({ status: "active", markSyncedNow: true }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(200);
    expect(countInFlightMock).not.toHaveBeenCalled();
  });
});
