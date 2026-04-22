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
});
