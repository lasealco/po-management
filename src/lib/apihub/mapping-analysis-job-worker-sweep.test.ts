import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const updateManyMock = vi.fn();
const processMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubMappingAnalysisJob: {
      findFirst: findFirstMock,
      updateMany: updateManyMock,
    },
  },
}));

vi.mock("@/lib/apihub/mapping-analysis-job-process", () => ({
  processApiHubMappingAnalysisJob: processMock,
}));

describe("runApiHubMappingAnalysisWorkerSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyMock.mockResolvedValue({ count: 0 });
  });

  it("stops when no queued jobs", async () => {
    findFirstMock.mockResolvedValue(null);
    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(5);
    expect(r.reclaimedStale).toBe(0);
    expect(r.claimedAndFinished).toBe(0);
    expect(r.attempts).toBe(0);
    expect(r.jobIdsTried).toEqual([]);
    expect(processMock).not.toHaveBeenCalled();
  });

  it("processes until cap or empty and counts claimed runs", async () => {
    findFirstMock
      .mockResolvedValueOnce({ id: "a", tenantId: "t1" })
      .mockResolvedValueOnce({ id: "b", tenantId: "t1" })
      .mockResolvedValueOnce(null);
    processMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(5);
    expect(r.attempts).toBe(2);
    expect(r.claimedAndFinished).toBe(1);
    expect(r.jobIdsTried).toEqual(["a", "b"]);
    expect(processMock).toHaveBeenNthCalledWith(1, "a", "t1");
    expect(processMock).toHaveBeenNthCalledWith(2, "b", "t1");
  });

  it("clamps limit to max", async () => {
    findFirstMock.mockResolvedValue({ id: "j-repeat", tenantId: "t1" });
    processMock.mockResolvedValue(true);
    const { runApiHubMappingAnalysisWorkerSweep, APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT } = await import(
      "./mapping-analysis-job-worker-sweep"
    );
    await runApiHubMappingAnalysisWorkerSweep(999);
    expect(processMock).toHaveBeenCalledTimes(APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT);
    expect(findFirstMock.mock.calls.length).toBe(APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT);
  });

  it("reclaims stale processing jobs before draining queued", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 3 });
    findFirstMock.mockResolvedValue(null);
    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(5);
    expect(r.reclaimedStale).toBe(3);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(r.claimedAndFinished).toBe(0);
  });
});
