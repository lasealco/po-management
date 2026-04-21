import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubIngestionRunByIdMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
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
      preview: [
        {
          recordIndex: 0,
          mapped: { shipmentId: "sh-1", amount: 42.5 },
          issues: [],
        },
      ],
    });
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
            },
            {
              field: "rules[0].targetField",
              code: "REQUIRED",
              message: "targetField is required.",
            },
            {
              field: "records",
              code: "INVALID_TYPE",
              message: "records must be an object or array of objects.",
            },
          ],
          summary: {
            totalErrors: 3,
            byCode: {
              REQUIRED: 2,
              INVALID_TYPE: 1,
            },
          },
        },
      },
    });
  });
});
