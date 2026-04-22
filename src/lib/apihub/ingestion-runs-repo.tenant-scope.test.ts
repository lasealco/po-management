import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const groupBy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubIngestionRun: {
      findFirst,
      findMany,
      count,
      groupBy,
    },
  },
}));

describe("ingestion-runs-repo tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getApiHubIngestionRunById passes tenantId in where", async () => {
    findFirst.mockResolvedValue(null);
    const { getApiHubIngestionRunById } = await import("./ingestion-runs-repo");
    await getApiHubIngestionRunById({ tenantId: "tenant-z", runId: "run-99" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-z", id: "run-99" },
      }),
    );
  });

  it("listApiHubIngestionRuns passes tenantId in where", async () => {
    findMany.mockResolvedValue([]);
    const { listApiHubIngestionRuns } = await import("./ingestion-runs-repo");
    await listApiHubIngestionRuns({
      tenantId: "tenant-z",
      status: null,
      limit: 10,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-z" }),
      }),
    );
  });

  it("countInFlightApiHubIngestionRunsForConnector passes tenantId in where", async () => {
    count.mockResolvedValue(0);
    const { countInFlightApiHubIngestionRunsForConnector } = await import("./ingestion-runs-repo");
    await countInFlightApiHubIngestionRunsForConnector({ tenantId: "tenant-inflight", connectorId: "conn-1" });
    expect(count).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-inflight",
        connectorId: "conn-1",
        status: { in: ["queued", "running"] },
      },
    });
  });

  it("getApiHubIngestionRunOpsSummary passes tenantId in every groupBy where", async () => {
    groupBy.mockResolvedValue([]);
    const { getApiHubIngestionRunOpsSummary } = await import("./ingestion-runs-repo");
    const asOf = new Date("2026-01-15T12:00:00.000Z");
    await getApiHubIngestionRunOpsSummary({ tenantId: "tenant-ops", asOf });
    expect(groupBy).toHaveBeenCalledTimes(3);
    for (const call of groupBy.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-ops" }),
        }),
      );
    }
  });
});
