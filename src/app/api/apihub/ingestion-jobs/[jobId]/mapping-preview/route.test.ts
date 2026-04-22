import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_MAPPING_PREVIEW_SAMPLE_MAX } from "@/lib/apihub/constants";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubIngestionRunByIdMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock, userHasGlobalGrant: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  getApiHubIngestionRunById: getApiHubIngestionRunByIdMock,
}));

describe("POST /api/apihub/ingestion-jobs/:jobId/mapping-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when run is missing", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "map-preview-miss-1" },
        body: JSON.stringify({ records: {}, rules: [] }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("map-preview-miss-1");
  });

  it("returns mapping preview for deterministic rules", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-ok-1",
        },
        body: JSON.stringify({
          records: [{ shipment: { id: " sh-1 " }, totals: { amount: "42.5" } }],
          rules: [
            { sourcePath: "shipment.id", targetField: "shipmentId", transform: "trim", required: true },
            { sourcePath: "totals.amount", targetField: "amount", transform: "number" },
          ],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("map-preview-ok-1");
    expect(await response.json()).toEqual({
      runId: "run-1",
      sampling: {
        totalRecords: 1,
        previewedRecords: 1,
        maxSampleSize: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX,
        requestedSampleSize: null,
        sampleSizeCapped: false,
        truncated: false,
      },
      preview: [
        {
          recordIndex: 0,
          mapped: { shipmentId: "sh-1", amount: 42.5 },
          issues: [],
        },
      ],
    });
  });

  it("limits preview rows when sampleSize is set", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const records = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-sample-1",
        },
        body: JSON.stringify({
          records,
          sampleSize: 2,
          rules: [{ sourcePath: "n", targetField: "n", transform: "number" }],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sampling: Record<string, unknown>;
      preview: { recordIndex: number; mapped: { n: number } }[];
    };
    expect(body.sampling).toEqual({
      totalRecords: 4,
      previewedRecords: 2,
      maxSampleSize: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX,
      requestedSampleSize: 2,
      sampleSizeCapped: false,
      truncated: true,
    });
    expect(body.preview).toEqual([
      { recordIndex: 0, mapped: { n: 1 }, issues: [] },
      { recordIndex: 1, mapped: { n: 2 }, issues: [] },
    ]);
  });

  it("clamps sampleSize to maxSampleSize", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const records = Array.from({ length: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX + 3 }, (_, i) => ({ i }));
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-cap-1",
        },
        body: JSON.stringify({
          records,
          sampleSize: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX + 1,
          rules: [{ sourcePath: "i", targetField: "i", transform: "number" }],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sampling: Record<string, unknown>;
      preview: unknown[];
    };
    expect(body.preview).toHaveLength(APIHUB_MAPPING_PREVIEW_SAMPLE_MAX);
    expect(body.sampling).toEqual({
      totalRecords: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX + 3,
      previewedRecords: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX,
      maxSampleSize: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX,
      requestedSampleSize: APIHUB_MAPPING_PREVIEW_SAMPLE_MAX + 1,
      sampleSizeCapped: true,
      truncated: true,
    });
  });

  it("returns 400 for invalid sampleSize", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-bad-ss",
        },
        body: JSON.stringify({
          records: [{ x: 1 }],
          sampleSize: 0,
          rules: [{ sourcePath: "x", targetField: "out", transform: "number" }],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      ok: false;
      error: { details?: { issues: Array<{ field: string; code: string }> } };
    };
    expect(body.error.details?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sampleSize", code: "OUT_OF_RANGE" })]),
    );
  });

  it("returns 400 when rules have duplicate targetField", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-dup-1",
        },
        body: JSON.stringify({
          records: [{ a: 1, b: 2 }],
          rules: [
            { sourcePath: "a", targetField: "out", transform: "identity" },
            { sourcePath: "b", targetField: "out", transform: "identity" },
          ],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      ok: false;
      error: { details?: { issues: Array<{ field: string; code: string }> } };
    };
    expect(body.error.details?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "rules[1].targetField",
          code: "DUPLICATE_TARGET",
        }),
      ]),
    );
  });

  it("returns 400 when sourcePath has invalid path syntax", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-path-1",
        },
        body: JSON.stringify({
          records: [{ x: 1 }],
          rules: [{ sourcePath: "x..y", targetField: "out" }],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      ok: false;
      error: { details?: { issues: Array<{ field: string; code: string }> } };
    };
    expect(body.error.details?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "rules[0].sourcePath",
          code: "INVALID_SOURCE_PATH",
        }),
      ]),
    );
  });

  it("returns structured validation errors for invalid payload", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "map-preview-val-1",
        },
        body: JSON.stringify({
          records: 42,
          rules: [{ sourcePath: "", targetField: "" }],
        }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("map-preview-val-1");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Mapping preview payload validation failed.",
        details: {
          issues: [
            {
              field: "rules[0].sourcePath",
              code: "REQUIRED",
              message: "sourcePath is required.",
              severity: "error",
            },
            {
              field: "rules[0].targetField",
              code: "REQUIRED",
              message: "targetField is required.",
              severity: "error",
            },
            {
              field: "records",
              code: "INVALID_TYPE",
              message: "records must be an object or array of objects.",
              severity: "error",
            },
          ],
          summary: {
            totalErrors: 3,
            byCode: {
              REQUIRED: 2,
              INVALID_TYPE: 1,
            },
            bySeverity: { error: 3, warn: 0, info: 0 },
          },
        },
      },
    });
  });
});
