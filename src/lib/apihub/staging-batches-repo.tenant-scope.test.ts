import { beforeEach, describe, expect, it, vi } from "vitest";

const batchFindFirst = vi.fn();
const batchFindMany = vi.fn();
const batchUpdateMany = vi.fn();
const rowFindMany = vi.fn();
const jobFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubStagingBatch: {
      findFirst: batchFindFirst,
      findMany: batchFindMany,
      updateMany: batchUpdateMany,
    },
    apiHubStagingRow: {
      findMany: rowFindMany,
    },
    apiHubMappingAnalysisJob: {
      findFirst: jobFindFirst,
    },
    $transaction: vi.fn(),
  },
}));

describe("staging-batches-repo tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listApiHubStagingBatches passes tenantId in where", async () => {
    batchFindMany.mockResolvedValue([]);
    const { listApiHubStagingBatches } = await import("./staging-batches-repo");
    await listApiHubStagingBatches({ tenantId: "tenant-s1", limit: 10 });
    expect(batchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-s1" },
      }),
    );
  });

  it("getApiHubStagingBatchWithRows scopes batch and rows to tenant", async () => {
    batchFindFirst.mockResolvedValue({
      id: "batch-1",
      tenantId: "tenant-s2",
      createdByUserId: "u1",
      sourceMappingAnalysisJobId: null,
      title: null,
      status: "open",
      rowCount: 0,
      appliedAt: null,
      applySummary: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    rowFindMany.mockResolvedValue([]);
    const { getApiHubStagingBatchWithRows } = await import("./staging-batches-repo");
    await getApiHubStagingBatchWithRows({ tenantId: "tenant-s2", batchId: "batch-1", rowLimit: 100 });
    expect(batchFindFirst).toHaveBeenCalledWith({
      where: { id: "batch-1", tenantId: "tenant-s2" },
      select: expect.any(Object),
    });
    expect(rowFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-s2", batchId: "batch-1" },
      orderBy: { rowIndex: "asc" },
      take: 100,
      select: expect.any(Object),
    });
  });

  it("discardApiHubStagingBatch updates with id + tenantId", async () => {
    batchFindFirst.mockResolvedValue({ id: "batch-2", status: "open", appliedAt: null });
    batchUpdateMany.mockResolvedValue({ count: 1 });
    const { discardApiHubStagingBatch } = await import("./staging-batches-repo");
    const out = await discardApiHubStagingBatch({ tenantId: "tenant-s3", batchId: "batch-2" });
    expect(out).toEqual({ ok: true });
    expect(batchFindFirst).toHaveBeenCalledWith({
      where: { id: "batch-2", tenantId: "tenant-s3" },
      select: { id: true, status: true, appliedAt: true },
    });
    expect(batchUpdateMany).toHaveBeenCalledWith({
      where: { id: "batch-2", tenantId: "tenant-s3" },
      data: { status: "discarded" },
    });
  });

  it("createApiHubStagingBatchFromAnalysisJob loads succeeded job scoped to tenant", async () => {
    jobFindFirst.mockResolvedValue(null);
    const { createApiHubStagingBatchFromAnalysisJob } = await import("./staging-batches-repo");
    await expect(
      createApiHubStagingBatchFromAnalysisJob({
        tenantId: "tenant-s4",
        actorUserId: "u1",
        mappingAnalysisJobId: "job-9",
        title: null,
      }),
    ).rejects.toThrow(/Analysis job not found/);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-9", tenantId: "tenant-s4", status: "succeeded" },
    });
  });
});
