import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const applyApiHubIngestionRunMock = vi.fn();
const toApiHubIngestionRunDtoMock = vi.fn();

const idemMocks = vi.hoisted(() => ({
  findApplyIdempotencyRecord: vi.fn(),
  createApplyIdempotencyRecord: vi.fn(),
}));

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-apply-repo", () => ({
  applyApiHubIngestionRun: applyApiHubIngestionRunMock,
}));
vi.mock("@/lib/apihub/ingestion-run-dto", () => ({ toApiHubIngestionRunDto: toApiHubIngestionRunDtoMock }));
vi.mock("@/lib/apihub/ingestion-apply-idempotency-repo", () => ({
  findApplyIdempotencyRecord: idemMocks.findApplyIdempotencyRecord,
  createApplyIdempotencyRecord: idemMocks.createApplyIdempotencyRecord,
}));

describe("POST /api/apihub/ingestion-jobs/:jobId/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    idemMocks.findApplyIdempotencyRecord.mockResolvedValue(null);
    idemMocks.createApplyIdempotencyRecord.mockResolvedValue({ created: true });
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
    expect(applyApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      runId: "run-1",
      dryRun: false,
    });
  });

  it("returns 200 dry-run write summary when dryRun=1", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({
      kind: "dry_run",
      wouldApply: true,
      run: { id: "run-1" },
    });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "dto-1", appliedAt: null });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply?dryRun=1", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "apply-dry" },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      dryRun: true,
      writeSummary: { wouldApply: true, wouldSetAppliedAt: true },
      run: { id: "dto-1", appliedAt: null },
    });
    expect(applyApiHubIngestionRunMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      runId: "run-1",
      dryRun: true,
    });
  });

  it("returns 200 dry-run with gate when apply would be blocked", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({
      kind: "dry_run",
      wouldApply: false,
      run: { id: "run-1" },
      gate: { type: "not_succeeded", status: "queued" },
    });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "dto-1", status: "queued" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: {
          [APIHUB_REQUEST_ID_HEADER]: "apply-dry-gate",
          "content-type": "application/json",
        },
        body: JSON.stringify({ dryRun: true }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      dryRun: true,
      writeSummary: {
        wouldApply: false,
        wouldSetAppliedAt: false,
        gate: { type: "not_succeeded", status: "queued" },
      },
      run: { id: "dto-1", status: "queued" },
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

  it("replays stored response when idempotency-key matches same run (no apply call)", async () => {
    idemMocks.findApplyIdempotencyRecord.mockResolvedValue({
      id: "row-1",
      tenantId: "tenant-1",
      idempotencyKey: "apply-idem-1",
      ingestionRunId: "run-1",
      dryRun: false,
      responseStatus: 200,
      responseBody: { applied: true, run: { id: "from-cache", appliedAt: "2026-01-01T00:00:00.000Z" } },
      createdAt: new Date("2026-04-22T12:00:00.000Z"),
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: {
          [APIHUB_REQUEST_ID_HEADER]: "apply-idem-replay",
          "idempotency-key": "apply-idem-1",
        },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(applyApiHubIngestionRunMock).not.toHaveBeenCalled();
    expect(idemMocks.createApplyIdempotencyRecord).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applied: true,
      run: { id: "from-cache", appliedAt: "2026-01-01T00:00:00.000Z" },
      idempotentReplay: true,
    });
  });

  it("returns 409 APPLY_IDEMPOTENCY_KEY_CONFLICT when key is bound to another run", async () => {
    idemMocks.findApplyIdempotencyRecord.mockResolvedValue({
      id: "row-1",
      tenantId: "tenant-1",
      idempotencyKey: "shared-key",
      ingestionRunId: "run-other",
      dryRun: false,
      responseStatus: 200,
      responseBody: { applied: true, run: { id: "other" } },
      createdAt: new Date(),
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: {
          [APIHUB_REQUEST_ID_HEADER]: "apply-idem-conflict",
          "idempotency-key": "shared-key",
        },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(applyApiHubIngestionRunMock).not.toHaveBeenCalled();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "APPLY_IDEMPOTENCY_KEY_CONFLICT",
        message: "This idempotency key is already used for a different ingestion apply.",
      },
    });
  });

  it("persists idempotency record after apply and replays on create race", async () => {
    applyApiHubIngestionRunMock.mockResolvedValue({ kind: "applied", run: { id: "run-1" } });
    toApiHubIngestionRunDtoMock.mockReturnValue({ id: "dto-live", appliedAt: "2026-04-22T10:00:11.000Z" });
    idemMocks.createApplyIdempotencyRecord.mockResolvedValue({
      created: false,
      existing: {
        id: "row-1",
        tenantId: "tenant-1",
        idempotencyKey: "race-key",
        ingestionRunId: "run-1",
        dryRun: false,
        responseStatus: 200,
        responseBody: { applied: true, run: { id: "winner-dto", appliedAt: "2026-04-22T09:00:00.000Z" } },
        createdAt: new Date(),
      },
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/apply", {
        method: "POST",
        headers: {
          [APIHUB_REQUEST_ID_HEADER]: "apply-idem-race",
          "idempotency-key": "race-key",
        },
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(idemMocks.createApplyIdempotencyRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        idempotencyKey: "race-key",
        runId: "run-1",
        dryRun: false,
        responseStatus: 200,
        responseBody: {
          applied: true,
          run: { id: "dto-live", appliedAt: "2026-04-22T10:00:11.000Z" },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applied: true,
      run: { id: "winner-dto", appliedAt: "2026-04-22T09:00:00.000Z" },
      idempotentReplay: true,
    });
  });
});
