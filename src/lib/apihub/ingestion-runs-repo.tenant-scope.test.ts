import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubIngestionRun: {
      findFirst,
      findMany,
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
});
