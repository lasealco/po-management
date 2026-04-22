import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubIngestionRunByIdMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock, userHasGlobalGrant: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  getApiHubIngestionRunById: getApiHubIngestionRunByIdMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({ toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock }));

describe("POST /api/apihub/ingestion-jobs/:jobId/apply/rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when run is missing", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/missing/apply/rollback", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "rb-404" },
      }),
      { params: Promise.resolve({ jobId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns 200 stub rollback envelope and run dto", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1", status: "succeeded" });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "dto-1", status: "succeeded", appliedAt: "2026-01-01T00:00:00.000Z" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply/rollback", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "rb-ok" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rollback: {
        stub: true,
        implemented: false,
        effect: "none",
        message: "Apply rollback is not implemented; no database or downstream changes were made.",
      },
      run: { id: "dto-1", status: "succeeded", appliedAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(getApiHubIngestionRunByIdMock).toHaveBeenCalledWith({ tenantId: "tenant-1", runId: "run-1" });
  });
});
