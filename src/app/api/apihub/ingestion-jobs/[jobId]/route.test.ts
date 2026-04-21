import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubIngestionRunByIdMock = vi.fn();
const transitionApiHubIngestionRunMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();
const canTransitionRunStatusMock = vi.fn();
const isValidRunStatusMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  getApiHubIngestionRunById: getApiHubIngestionRunByIdMock,
  transitionApiHubIngestionRun: transitionApiHubIngestionRunMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({ toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock }));
vi.mock("@/lib/apihub/run-lifecycle", () => ({
  canTransitionRunStatus: canTransitionRunStatusMock,
  isValidRunStatus: isValidRunStatusMock,
}));

describe("GET /api/apihub/ingestion-jobs/:jobId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when run is missing", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs/missing", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "job-get-404" },
      }),
      { params: Promise.resolve({ jobId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns run with derived observability timings and retry counters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T10:00:50.000Z"));

    // Current run is a retry of r1 (depth 1); r1 has no parent.
    getApiHubIngestionRunByIdMock.mockImplementation(async ({ runId }: { runId: string }) => {
      if (runId === "r2") {
        return {
          id: "r2",
          attempt: 2,
          maxAttempts: 3,
          enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
          startedAt: new Date("2026-04-22T10:00:10.000Z"),
          finishedAt: new Date("2026-04-22T10:00:40.000Z"),
          retryOfRunId: "r1",
        };
      }
      if (runId === "r1") {
        return {
          id: "r1",
          attempt: 1,
          maxAttempts: 3,
          enqueuedAt: new Date("2026-04-22T09:59:00.000Z"),
          startedAt: null,
          finishedAt: null,
          retryOfRunId: null,
        };
      }
      return null;
    });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "dto-r2" });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs/r2", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "job-get-metrics" },
      }),
      { params: Promise.resolve({ jobId: "r2" }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      run: { id: string };
      observability: {
        timings: { queueWaitMs: number | null; runMs: number | null; totalMs: number | null; ageMs: number };
        retries: { retryDepth: number; rootRunId: string; remainingAttempts: number };
      };
    };
    expect(body.run.id).toBe("dto-r2");
    expect(body.observability.retries).toEqual({ retryDepth: 1, rootRunId: "r1", remainingAttempts: 1 });
    expect(body.observability.timings.queueWaitMs).toBe(10_000);
    expect(body.observability.timings.runMs).toBe(30_000);
    expect(body.observability.timings.totalMs).toBe(40_000);
    expect(body.observability.timings.ageMs).toBe(40_000);

    vi.useRealTimers();
  });
});

describe("PATCH /api/apihub/ingestion-jobs/:jobId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isValidRunStatusMock.mockReturnValue(true);
    canTransitionRunStatusMock.mockReturnValue(true);
  });

  it("returns 400 for invalid status", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    isValidRunStatusMock.mockReturnValue(false);
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/ingestion-jobs/job-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "job-patch-bad-1" },
        body: JSON.stringify({ status: "wat" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("job-patch-bad-1");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Run payload validation failed.",
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
            byCode: { INVALID_ENUM: 1 },
          },
        },
      },
    });
  });

  it("transitions run", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1", status: "queued" });
    transitionApiHubIngestionRunMock.mockResolvedValue({ id: "run-1" });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "run-dto-1" });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/ingestion-jobs/job-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "job-patch-ok-1" },
        body: JSON.stringify({ status: "running", resultSummary: " started " }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("job-patch-ok-1");
    expect(transitionApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      runId: "job-1",
      nextStatus: "running",
      resultSummary: "started",
      errorCode: null,
      errorMessage: null,
    });
  });

  it("returns 409 RUN_TRANSITION_STALE when atomic transition conflicts", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1", status: "queued" });
    transitionApiHubIngestionRunMock.mockRejectedValue(new Error("run_transition_stale"));
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/ingestion-jobs/job-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [APIHUB_REQUEST_ID_HEADER]: "job-patch-stale" },
        body: JSON.stringify({ status: "running" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "RUN_TRANSITION_STALE",
        message:
          "Run status changed before this update applied; fetch the latest run and retry if appropriate.",
      },
    });
  });
});
