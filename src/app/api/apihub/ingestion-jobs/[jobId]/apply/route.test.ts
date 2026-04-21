import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const applyApiHubIngestionRunMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-apply-repo", () => ({
  applyApiHubIngestionRun: applyApiHubIngestionRunMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({ toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock }));

describe("POST /api/apihub/ingestion-jobs/:jobId/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when run is missing", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/missing/apply", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-404" },
      }),
      { params: Promise.resolve({ jobId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns 200 with applied payload on success", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({ kind: "applied", run: { id: "run-1" } });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "dto-1", appliedAt: "2026-04-22T10:00:11.000Z" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-ok" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applied: true,
      run: { id: "dto-1", appliedAt: "2026-04-22T10:00:11.000Z" },
    });
  });

  it("returns 409 APPLY_RUN_NOT_SUCCEEDED", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({ kind: "not_succeeded", status: "queued" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-ns" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "APPLY_RUN_NOT_SUCCEEDED",
        message: "Apply requires a succeeded ingestion run (current status: queued).",
      },
    });
  });

  it("returns 409 APPLY_ALREADY_APPLIED", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({ kind: "already_applied", run: { id: "run-1" } });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-dup" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "APPLY_ALREADY_APPLIED",
        message: "This ingestion run was already marked as applied.",
      },
    });
  });

  it("returns 409 APPLY_BLOCKED_CONNECTOR_NOT_FOUND", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({ kind: "blocked", reason: "connector_not_found" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-blk-m" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "APPLY_BLOCKED_CONNECTOR_NOT_FOUND",
        message: "Apply is blocked because the linked connector no longer exists.",
      },
    });
  });

  it("returns 409 APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({
      kind: "blocked",
      reason: "connector_not_active",
      connectorStatus: "draft",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-blk-a" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE",
        message: "Apply is blocked because the linked connector is not active (status: draft).",
      },
    });
  });
});
