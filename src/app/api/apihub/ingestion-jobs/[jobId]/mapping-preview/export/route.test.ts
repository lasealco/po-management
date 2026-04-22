import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubIngestionRunByIdMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock, userHasGlobalGrant: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  getApiHubIngestionRunById: getApiHubIngestionRunByIdMock,
}));

describe("POST /api/apihub/ingestion-jobs/:jobId/mapping-preview/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 400 when format is missing or invalid", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-export-bad-fmt",
        },
        body: JSON.stringify({
          records: [{ x: 1 }],
          rules: [{ sourcePath: "x", targetField: "out", transform: "number" }],
          format: "xml",
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns CSV attachment with issues", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-export-csv-1",
        },
        body: JSON.stringify({
          records: [{ x: "nope" }],
          rules: [{ sourcePath: "x", targetField: "out", transform: "number", required: true }],
          format: "csv",
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("mapping-preview-issues-run-1");
    const text = await response.text();
    expect(text).toContain("recordIndex,field,code,severity,message");
    expect(text).toContain("INVALID_NUMBER");
  });

  it("returns JSON attachment including sampling", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-export-json-1",
        },
        body: JSON.stringify({
          records: [{ a: 1 }],
          rules: [{ sourcePath: "a", targetField: "a", transform: "number" }],
          format: "json",
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const body = JSON.parse(await response.text()) as { runId: string; sampling: { totalRecords: number }; preview: unknown[] };
    expect(body.runId).toBe("run-1");
    expect(body.sampling.totalRecords).toBe(1);
    expect(Array.isArray(body.preview)).toBe(true);
  });
});
