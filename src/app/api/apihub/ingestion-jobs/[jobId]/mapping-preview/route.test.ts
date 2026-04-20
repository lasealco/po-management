import { beforeEach, describe, expect, it, vi } from "vitest";

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
        body: JSON.stringify({ records: {}, rules: [] }),
      }),
      { params: Promise.resolve({ jobId: "run-1" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns mapping preview for deterministic rules", async () => {
    getApiHubIngestionRunByIdMock.mockResolvedValue({ id: "run-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/ingestion-jobs/run-1/mapping-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
});
