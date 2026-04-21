import { describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubConnectorHealthContextMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/connectors-repo", () => ({
  getApiHubConnectorHealthContext: getApiHubConnectorHealthContextMock,
}));

describe("GET /api/apihub/connectors/:connectorId/health", () => {
  it("returns 404 when connector is missing", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubConnectorHealthContextMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors/missing/health", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-health-404" },
      }),
      { params: Promise.resolve({ connectorId: "missing" }) },
    );
    expect(response.status).toBe(404);
    expect(getApiHubConnectorHealthContextMock).toHaveBeenCalledWith("tenant-1", "missing");
  });

  it("returns health envelope with request id", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubConnectorHealthContextMock.mockResolvedValue({
      id: "c1",
      sourceKind: "stub",
      status: "draft",
      authMode: "none",
      authState: "not_configured",
      authConfigRef: null,
      lastSyncAt: null,
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors/c1/health", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-health-ok" },
      }),
      { params: Promise.resolve({ connectorId: "c1" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("conn-health-ok");
    const body = (await response.json()) as {
      ok: boolean;
      service: string;
      phase: string;
      connectorId: string;
      health: { state: string; summary: string; readinessOverall: string };
    };
    expect(body.ok).toBe(true);
    expect(body.connectorId).toBe("c1");
    expect(body.service).toBe("apihub");
    expect(body.health.state).toBe("degraded");
    expect(body.health.readinessOverall).toBe("attention");
    expect(typeof body.health.summary).toBe("string");
    expect(body.health.summary.length).toBeGreaterThan(0);
  });
});
