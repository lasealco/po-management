import { beforeEach, describe, expect, it, vi } from "vitest";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const applyApiHubIngestionRunMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  applyApiHubIngestionRun: applyApiHubIngestionRunMock,
}));

describe("POST /api/apihub/ingestion-jobs/:jobId/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 409 when run is not succeeded", async () => {
    applyApiHubIngestionRunMock.mockRejectedValue(new Error("apply_requires_succeeded_status"));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "APPLY_REQUIRES_SUCCEEDED",
        message: "Only succeeded runs can be applied.",
      },
    });
  });

  it("returns apply result and audit log metadata", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({
      run: { id: "run-1" },
      applied: true,
      auditLog: {
        id: "audit-1",
        action: "run.apply.completed",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: " applied to ct shipments " }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(200);
    expect(applyApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      runId: "run-1",
      actorUserId: "user-1",
      note: "applied to ct shipments",
    });
    expect(await response.json()).toEqual({
      runId: "run-1",
      applied: true,
      auditLog: {
        id: "audit-1",
        action: "run.apply.completed",
      },
    });
  });
});
