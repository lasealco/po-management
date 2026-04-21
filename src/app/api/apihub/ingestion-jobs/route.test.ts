import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listApiHubIngestionRunsMock = vi.fn();
const createApiHubIngestionRunMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  listApiHubIngestionRuns: listApiHubIngestionRunsMock,
  createApiHubIngestionRun: createApiHubIngestionRunMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({ toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock }));

describe("GET /api/apihub/ingestion-jobs", () => {
  beforeEach(() => vi.clearAllMocks());

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
    listApiHubIngestionRunsMock.mockResolvedValue([{ id: "run-1" }]);
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
    });
    expect(await response.json()).toEqual({ runs: [{ id: "run-dto-1" }] });
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
