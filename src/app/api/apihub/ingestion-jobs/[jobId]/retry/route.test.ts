import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const retryApiHubIngestionRunMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  retryApiHubIngestionRun: retryApiHubIngestionRunMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({
  toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock,
}));

describe("POST /api/apihub/ingestion-jobs/:jobId/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns structured conflict contract for non-failed runs", async () => {
    retryApiHubIngestionRunMock.mockRejectedValue(new Error("retry_requires_failed_status"));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "retry-conflict-1" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(409);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("retry-conflict-1");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "RETRY_REQUIRES_FAILED",
        message: "Only failed runs can be retried.",
      },
    });
  });

  it("returns 201 with run payload on successful retry", async () => {
    retryApiHubIngestionRunMock.mockResolvedValue({ run: { id: "run-2" }, idempotentReplay: false });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "run-dto-2" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": "retry-123",
          [APIHUB_REQUEST_ID_HEADER]: "retry-success-1",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("retry-success-1");
    expect(retryApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      runId: "run-1",
      idempotencyKey: "retry-123",
    });
    expect(await response.json()).toEqual({ run: { id: "run-dto-2" }, idempotentReplay: false });
  });

  it("returns 200 with idempotentReplay when retry key replays the same logical retry", async () => {
    retryApiHubIngestionRunMock.mockResolvedValue({ run: { id: "run-2" }, idempotentReplay: true });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "run-dto-2" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": "retry-replay",
          [APIHUB_REQUEST_ID_HEADER]: "retry-replay-1",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ run: { id: "run-dto-2" }, idempotentReplay: true });
  });

  it("returns 409 when idempotency key belongs to a different run", async () => {
    retryApiHubIngestionRunMock.mockRejectedValue(new Error("retry_idempotency_key_conflict"));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": "used-elsewhere",
          [APIHUB_REQUEST_ID_HEADER]: "retry-idem-conflict",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "RETRY_IDEMPOTENCY_KEY_CONFLICT",
        message: "This idempotency key is already used for a different ingestion run.",
      },
    });
  });
});
