import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubMappingAnalysisJob: {
      findFirst,
      findMany,
      create,
    },
  },
}));

describe("mapping-analysis-jobs-repo tenant scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes getApiHubMappingAnalysisJob to tenantId + jobId", async () => {
    findFirst.mockResolvedValue(null);
    const { getApiHubMappingAnalysisJob } = await import("./mapping-analysis-jobs-repo");
    await getApiHubMappingAnalysisJob({ tenantId: "t-a", jobId: "j1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "j1", tenantId: "t-a" },
      select: expect.any(Object) as unknown,
    });
  });

  it("scopes listApiHubMappingAnalysisJobs to tenantId", async () => {
    findMany.mockResolvedValue([]);
    const { listApiHubMappingAnalysisJobs } = await import("./mapping-analysis-jobs-repo");
    await listApiHubMappingAnalysisJobs({ tenantId: "t-a", limit: 5 });
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: "t-a" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: expect.any(Object) as unknown,
    });
  });

  it("uses distinct tenant ids in where clauses (non–demo tenant safe)", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    const { getApiHubMappingAnalysisJob, listApiHubMappingAnalysisJobs } = await import("./mapping-analysis-jobs-repo");
    await getApiHubMappingAnalysisJob({ tenantId: "tenant-prod-99", jobId: "j1" });
    await listApiHubMappingAnalysisJobs({ tenantId: "tenant-prod-99", limit: 10 });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "j1", tenantId: "tenant-prod-99" },
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-prod-99" },
      }),
    );
  });
});
