import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

describe("claimNextQueuedApiHubMappingAnalysisJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns first row from RETURNING clause", async () => {
    queryRawMock.mockResolvedValue([{ id: "job-1", tenantId: "ten-a" }]);
    const { claimNextQueuedApiHubMappingAnalysisJob } = await import("./mapping-analysis-job-claim");
    const r = await claimNextQueuedApiHubMappingAnalysisJob();
    expect(r).toEqual({ id: "job-1", tenantId: "ten-a" });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when no queued rows", async () => {
    queryRawMock.mockResolvedValue([]);
    const { claimNextQueuedApiHubMappingAnalysisJob } = await import("./mapping-analysis-job-claim");
    const r = await claimNextQueuedApiHubMappingAnalysisJob();
    expect(r).toBeNull();
  });
});
