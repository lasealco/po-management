import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeIngestionRunListCursor } from "@/lib/apihub/ingestion-run-list-cursor";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubConnectorInTenantMock = vi.fn();
const listApiHubIngestionRunsMock = vi.fn();
const createApiHubIngestionRunMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/connectors-repo", () => ({
  getApiHubConnectorInTenant: getApiHubConnectorInTenantMock,
}));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  listApiHubIngestionRuns: listApiHubIngestionRunsMock,
  createApiHubIngestionRun: createApiHubIngestionRunMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({ toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock }));

const emptyListFilters = {
  connectorId: null,
  triggerKind: null,
  attemptRange: null,
} as const;

describe("GET /api/apihub/ingestion-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "conn-default", status: "active" });
  });

  it("returns 400 for invalid limit query", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?limit=not-a-number", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-limit-bad-1" },
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("ingest-limit-bad-1");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Run query validation failed.",
        details: {
          issues: [
            {
              field: "limit",
              code: "INVALID_NUMBER",
              message: "limit must be a finite number between 1 and 100.",
            },
          ],
          summary: { totalErrors: 1, byCode: { INVALID_NUMBER: 1 } },
        },
      },
    });
  });

  it("returns 400 for invalid status filter", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?status=bad", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-list-err-1" },
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("ingest-list-err-1");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Run query validation failed.",
        details: {
          issues: [
            {
              field: "status",
              code: "INVALID_ENUM",
              message: "status must be one of: queued, running, succeeded, failed.",
            },
          ],
          summary: {
            totalErrors: 1,
            byCode: {
              INVALID_ENUM: 1,
            },
          },
        },
      },
    });
  });

  it("lists runs with filters", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    listApiHubIngestionRunsMock.mockResolvedValue({ items: [{ id: "run-1" }], nextCursor: null });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "run-dto-1" });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?status=queued&limit=5", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-list-ok-1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("ingest-list-ok-1");
    expect(listApiHubIngestionRunsMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: "queued",
      limit: 5,
      cursor: null,
      ...emptyListFilters,
    });
    expect(await response.json()).toEqual({ runs: [{ id: "run-dto-1" }], nextCursor: null });
  });

  it("returns nextCursor from the list repo result", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    listApiHubIngestionRunsMock.mockResolvedValue({
      items: [{ id: "run-1" }],
      nextCursor: "opaque-next",
    });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "run-dto-1" });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?limit=2", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-list-cursor-out" },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { runs: unknown[]; nextCursor: string | null };
    expect(body.nextCursor).toBe("opaque-next");
  });

  it("returns 400 for invalid cursor", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?cursor=not-valid", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-cursor-bad" },
      }),
    );
    expect(response.status).toBe(400);
    expect(listApiHubIngestionRunsMock).not.toHaveBeenCalled();
    const body = (await response.json()) as {
      error: { details?: { issues: { field: string; code: string }[] } };
    };
    expect(body.error.details?.issues?.[0]?.field).toBe("cursor");
    expect(body.error.details?.issues?.[0]?.code).toBe("INVALID_CURSOR");
  });

  it("forwards decoded cursor to list", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    listApiHubIngestionRunsMock.mockResolvedValue({ items: [], nextCursor: null });
    const cursor = encodeIngestionRunListCursor(new Date("2026-04-22T08:00:00.000Z"), "clcursor1234567890abcd");
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/apihub/ingestion-jobs?cursor=${encodeURIComponent(cursor)}`, {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-cursor-ok" },
      }),
    );
    expect(response.status).toBe(200);
    expect(listApiHubIngestionRunsMock).toHaveBeenCalledTimes(1);
    const listArg = listApiHubIngestionRunsMock.mock.calls[0]![0];
    expect(listArg.tenantId).toBe("tenant-1");
    expect(listArg.status).toBeNull();
    expect(listArg.limit).toBe(20);
    expect(listArg.cursor?.id).toBe("clcursor1234567890abcd");
    expect(listArg).toMatchObject(emptyListFilters);
    expect(listArg.cursor?.createdAt.toISOString()).toBe("2026-04-22T08:00:00.000Z");
  });

  it("combines status filter with cursor", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    listApiHubIngestionRunsMock.mockResolvedValue({ items: [], nextCursor: null });
    const cursor = encodeIngestionRunListCursor(new Date("2026-04-22T09:00:00.000Z"), "clcursor2234567890abcd");
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        `http://localhost/api/apihub/ingestion-jobs?status=queued&cursor=${encodeURIComponent(cursor)}`,
        { headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-cursor-status" } },
      ),
    );
    expect(response.status).toBe(200);
    const listArg = listApiHubIngestionRunsMock.mock.calls[0]![0];
    expect(listArg.status).toBe("queued");
    expect(listArg.cursor?.id).toBe("clcursor2234567890abcd");
    expect(listArg).toMatchObject(emptyListFilters);
  });

  it("returns 400 for invalid triggerKind", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?triggerKind=unknown", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-tk-bad" },
      }),
    );
    expect(response.status).toBe(400);
    expect(listApiHubIngestionRunsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid attemptRange", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?attemptRange=5-1", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-ar-bad" },
      }),
    );
    expect(response.status).toBe(400);
    expect(listApiHubIngestionRunsMock).not.toHaveBeenCalled();
  });

  it("returns 404 when connectorId filter does not match tenant", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubConnectorInTenantMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs?connectorId=clmissing1234567890abcd", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-conn-404" },
      }),
    );
    expect(response.status).toBe(404);
    expect(getApiHubConnectorInTenantMock).toHaveBeenCalledWith("tenant-1", "clmissing1234567890abcd");
    expect(listApiHubIngestionRunsMock).not.toHaveBeenCalled();
  });

  it("resolves connector then lists with combined filters", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubConnectorInTenantMock.mockResolvedValue({ id: "clconn1234567890abcdef", status: "active" });
    listApiHubIngestionRunsMock.mockResolvedValue({ items: [], nextCursor: null });
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/apihub/ingestion-jobs?connectorId=clconn1234567890abcdef&status=failed&triggerKind=api&attemptRange=2-3&limit=10",
        { headers: { [APIHUB_REQUEST_ID_HEADER]: "ingest-combo" } },
      ),
    );
    expect(response.status).toBe(200);
    expect(getApiHubConnectorInTenantMock).toHaveBeenCalledWith("tenant-1", "clconn1234567890abcdef");
    expect(listApiHubIngestionRunsMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: "failed",
      limit: 10,
      cursor: null,
      connectorId: "clconn1234567890abcdef",
      triggerKind: "api",
      attemptRange: { min: 2, max: 3 },
    });
  });
});

describe("POST /api/apihub/ingestion-jobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates ingestion run", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    createApiHubIngestionRunMock.mockResolvedValue({ run: { id: "run-1" }, idempotentReplay: false });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "run-dto-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "ingest-create-1" },
        body: JSON.stringify({ connectorId: "connector-1", idempotencyKey: "abc" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("ingest-create-1");
    expect(createApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      connectorId: "connector-1",
      idempotencyKey: "abc",
    });
  });
});
