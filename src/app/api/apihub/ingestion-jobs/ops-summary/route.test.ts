import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getSummaryMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/ingestion-runs-repo", () => ({
  getApiHubIngestionRunOpsSummary: getSummaryMock,
}));

describe("GET /api/apihub/ingestion-jobs/ops-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns summary payload", async () => {
    const asOf = new Date("2026-04-22T12:00:00.000Z");
    getSummaryMock.mockResolvedValue({
      totals: { queued: 1, running: 0, succeeded: 5, failed: 1 },
      windows: {
        last24h: { queued: 0, running: 0, succeeded: 2, failed: 1 },
        previous24h: { queued: 1, running: 0, succeeded: 1, failed: 0 },
      },
      inFlight: 1,
      totalRuns: 7,
      asOf,
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/ingestion-jobs/ops-summary", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "ops-sum-1" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totals: { queued: 1, running: 0, succeeded: 5, failed: 1 },
      windows: {
        last24h: { queued: 0, running: 0, succeeded: 2, failed: 1 },
        previous24h: { queued: 1, running: 0, succeeded: 1, failed: 0 },
      },
      inFlight: 1,
      totalRuns: 7,
      asOf: "2026-04-22T12:00:00.000Z",
    });
    expect(getSummaryMock).toHaveBeenCalledWith({ tenantId: "tenant-1" });
  });
});
