import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubIngestionAlertsSummaryMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-alerts-summary-repo", () => ({
  getApiHubIngestionAlertsSummary: getApiHubIngestionAlertsSummaryMock,
}));

describe("GET /api/apihub/ingestion-alerts-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns summary payload", async () => {
    getApiHubIngestionAlertsSummaryMock.mockResolvedValue({
      generatedAt: "2026-04-22T12:00:00.000Z",
      limit: 10,
      counts: { error: 1, warn: 0, info: 0 },
      alerts: [
        {
          id: "a1",
          severity: "error",
          source: "apply",
          resultCode: "APPLY_RUN_NOT_SUCCEEDED",
          title: "t",
          detail: "d",
          createdAt: "2026-04-22T12:00:00.000Z",
          ingestionRunId: "run-1",
          httpStatus: 409,
          requestId: null,
        },
      ],
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-alerts-summary?limit=10", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "alerts-1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      generatedAt: "2026-04-22T12:00:00.000Z",
      limit: 10,
      counts: { error: 1, warn: 0, info: 0 },
      alerts: [
        {
          id: "a1",
          severity: "error",
          source: "apply",
          resultCode: "APPLY_RUN_NOT_SUCCEEDED",
          title: "t",
          detail: "d",
          createdAt: "2026-04-22T12:00:00.000Z",
          ingestionRunId: "run-1",
          httpStatus: 409,
          requestId: null,
        },
      ],
    });
    expect(getApiHubIngestionAlertsSummaryMock).toHaveBeenCalledWith({ tenantId: "tenant-1", limit: 10 });
  });
});
