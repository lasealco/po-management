import { beforeEach, describe, expect, it, vi } from "vitest";

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "wat" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(400);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running", resultSummary: " started " }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(200);
    expect(transitionApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      runId: "job-1",
      nextStatus: "running",
      resultSummary: "started",
      errorCode: null,
      errorMessage: null,
    });
  });
});
