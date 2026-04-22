import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_CONNECTOR_DISABLE_FORCE_NOTE_MIN, APIHUB_CONNECTOR_OPS_NOTE_MAX } from "@/lib/apihub/constants";
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
  listApiHubConnectorAuditLogs: vi.fn().mockResolvedValue([]),
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

  it("updates opsNote without sending status (uses stored status)", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "paused" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-ops" },
        body: JSON.stringify({ opsNote: "  line1\nline2  " }),
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
      note: null,
      opsNote: "line1\nline2",
    });
  });

  it("returns 400 when opsNote is not a string or null", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "draft" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-ops-type" },
        body: JSON.stringify({ opsNote: 99 }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(400);
    expect(updateApiHubConnectorLifecycleMock).not.toHaveBeenCalled();
  });

  it("returns 400 when opsNote exceeds max length after trim", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "draft" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-ops-len" },
        body: JSON.stringify({ opsNote: "x".repeat(APIHUB_CONNECTOR_OPS_NOTE_MAX + 1) }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(400);
    expect(updateApiHubConnectorLifecycleMock).not.toHaveBeenCalled();
  });

  it("accepts valid authConfigRef and forwards to lifecycle update", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "draft" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-ref-ok" },
        body: JSON.stringify({ authConfigRef: "  vault://mount/secret  " }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(200);
    expect(updateApiHubConnectorLifecycleMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      connectorId: "c1",
      actorUserId: "user-1",
      status: "draft",
      syncNow: false,
      note: null,
      authConfigRef: "vault://mount/secret",
    });
  });

  it("returns 400 when authConfigRef pattern is not allowlisted", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "draft" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-ref-bad" },
        body: JSON.stringify({ authConfigRef: "https://example.com/secret" }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(400);
    expect(updateApiHubConnectorLifecycleMock).not.toHaveBeenCalled();
    const body = (await response.json()) as {
      error: { details?: { issues: { field: string; code: string }[] } };
    };
    expect(body.error.details?.issues?.[0]?.field).toBe("authConfigRef");
    expect(body.error.details?.issues?.[0]?.code).toBe("INVALID_PATTERN");
  });

  it("clears authConfigRef with null", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "c1", status: "paused" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/connectors/c1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "patch-ref-null" },
        body: JSON.stringify({ authConfigRef: null }),
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(200);
    expect(updateApiHubConnectorLifecycleMock).toHaveBeenCalledWith(
      expect.objectContaining({ authConfigRef: null }),
    );
  });
});
