import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN } from "@/lib/apihub/connector-search";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listApiHubConnectorsMock = vi.fn();
const listApiHubConnectorAuditLogsMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/connectors-repo", () => ({
  listApiHubConnectors: listApiHubConnectorsMock,
  listApiHubConnectorAuditLogs: listApiHubConnectorAuditLogsMock,
  createStubApiHubConnector: vi.fn(),
}));

vi.mock("@/lib/apihub/connector-dto", () => ({
  toApiHubConnectorDto: (row: { id: string }) => ({ id: `dto-${row.id}` }),
}));

describe("GET /api/apihub/connectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    listApiHubConnectorAuditLogsMock.mockResolvedValue([]);
  });

  it("returns 400 for invalid status filter", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?status=nope", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-list-bad-status" },
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("conn-list-bad-status");
    const body = (await response.json()) as { error: { details: { issues: { field: string }[] } } };
    expect(body.error.details.issues[0]?.field).toBe("status");
  });

  it("returns 400 for invalid authMode filter", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?authMode=super_secret", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-list-bad-auth" },
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { issues: { field: string }[] } } };
    expect(body.error.details.issues[0]?.field).toBe("authMode");
  });

  it("returns combined validation issues for invalid status and authMode", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?status=bad&authMode=worse", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-list-bad-both" },
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { issues: { field: string }[] } } };
    const fields = body.error.details.issues.map((i) => i.field).sort();
    expect(fields).toEqual(["authMode", "status"]);
  });

  it("lists connectors with status and authMode filters", async () => {
    listApiHubConnectorsMock.mockResolvedValue([{ id: "c1" }]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?status=active&authMode=none", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-list-ok-1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(listApiHubConnectorsMock).toHaveBeenCalledWith("tenant-1", {
      status: "active",
      authMode: "none",
      q: undefined,
      sortField: undefined,
      sortOrder: undefined,
    });
    expect(await response.json()).toEqual({ connectors: [{ id: "dto-c1" }] });
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("conn-list-ok-1");
  });

  it("returns 400 when q exceeds max length", async () => {
    const { GET } = await import("./route");
    const longQ = "x".repeat(APIHUB_CONNECTOR_SEARCH_Q_MAX_LEN + 1);
    const response = await GET(
      new Request(`http://localhost/api/apihub/connectors?q=${encodeURIComponent(longQ)}`, {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-q-too-long" },
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { issues: { field: string }[] } } };
    expect(body.error.details.issues.map((i) => i.field)).toContain("q");
  });

  it("returns 400 for invalid sort field", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?sort=created", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-bad-sort" },
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { issues: { field: string }[] } } };
    expect(body.error.details.issues.map((i) => i.field)).toContain("sort");
  });

  it("returns 400 for invalid order", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?order=up", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-bad-order" },
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { issues: { field: string }[] } } };
    expect(body.error.details.issues.map((i) => i.field)).toContain("order");
  });

  it("passes sort and order to list filters", async () => {
    listApiHubConnectorsMock.mockResolvedValue([{ id: "c1" }]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?sort=name&order=asc", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-sort-ok" },
      }),
    );
    expect(response.status).toBe(200);
    expect(listApiHubConnectorsMock).toHaveBeenCalledWith("tenant-1", {
      status: undefined,
      authMode: undefined,
      q: undefined,
      sortField: "name",
      sortOrder: "asc",
    });
    expect(await response.json()).toEqual({ connectors: [{ id: "dto-c1" }] });
  });

  it("passes trimmed q to list filters", async () => {
    listApiHubConnectorsMock.mockResolvedValue([{ id: "c1" }]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/connectors?q=%20acme%20", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "conn-q-search" },
      }),
    );
    expect(response.status).toBe(200);
    expect(listApiHubConnectorsMock).toHaveBeenCalledWith("tenant-1", {
      status: undefined,
      authMode: undefined,
      q: "acme",
      sortField: undefined,
      sortOrder: undefined,
    });
    expect(await response.json()).toEqual({ connectors: [{ id: "dto-c1" }] });
  });
});
