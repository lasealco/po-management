import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubConnectorInTenantMock = vi.fn();
const listApiHubConnectorAuditLogsPageMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/connectors-repo", () => ({
  getApiHubConnectorInTenant: getApiHubConnectorInTenantMock,
  listApiHubConnectorAuditLogsPage: listApiHubConnectorAuditLogsPageMock,
}));

vi.mock("@/lib/apihub/connector-dto", () => ({
  toApiHubConnectorAuditLogDto: (row: { id: string }) => ({ id: `dto-${row.id}` }),
}));

describe("GET /api/apihub/connectors/:connectorId/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "conn-1" });
  });

  it("returns 404 when connector is not in tenant", async () => {
    getApiHubConnectorInTenantMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors/missing/audit", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "audit-miss-1" },
      }),
      { params: Promise.resolve({ connectorId: "missing" }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "CONNECTOR_NOT_FOUND" },
    });
  });

  it("returns 400 for invalid limit", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors/conn-1/audit?limit=xyz", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "audit-bad-limit" },
      }),
      { params: Promise.resolve({ connectorId: "conn-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid page", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors/conn-1/audit?page=0", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "audit-bad-page" },
      }),
      { params: Promise.resolve({ connectorId: "conn-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns paged audit rows and passes tenant-scoped args to repo", async () => {
    listApiHubConnectorAuditLogsPageMock.mockResolvedValue({
      items: [{ id: "a1" }],
      hasMore: true,
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors/conn-1/audit?limit=5&page=2", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "audit-ok-1" },
      }),
      { params: Promise.resolve({ connectorId: "conn-1" }) },
    );
    expect(response.status).toBe(200);
    expect(getApiHubConnectorInTenantMock).toHaveBeenCalledWith("tenant-1", "conn-1");
    expect(listApiHubConnectorAuditLogsPageMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      connectorId: "conn-1",
      limit: 5,
      offset: 5,
    });
    expect(await response.json()).toEqual({
      connectorId: "conn-1",
      page: 2,
      limit: 5,
      hasMore: true,
      audit: [{ id: "dto-a1" }],
    });
  });
});
