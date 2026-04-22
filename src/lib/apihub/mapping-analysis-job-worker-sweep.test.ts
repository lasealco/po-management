import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claimMock = vi.fn();
const executeMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubMappingAnalysisJob: {
      updateMany: updateManyMock,
    },
  },
}));

vi.mock("@/lib/apihub/mapping-analysis-job-claim", () => ({
  claimNextQueuedApiHubMappingAnalysisJob: claimMock,
}));

vi.mock("@/lib/apihub/mapping-analysis-job-process", () => ({
  executeApiHubMappingAnalysisJobForClaimedRow: executeMock,
}));

describe("runApiHubMappingAnalysisWorkerSweep", () => {
  const prevParallel = process.env.APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL;

  afterEach(() => {
    if (prevParallel === undefined) {
      delete process.env.APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL;
    } else {
      process.env.APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL = prevParallel;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL;
    updateManyMock.mockResolvedValue({ count: 0 });
  });

  it("stops when no queued jobs", async () => {
    claimMock.mockResolvedValue(null);
    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(5);
    expect(r.reclaimedStale).toBe(0);
    expect(r.claimedAndFinished).toBe(0);
    expect(r.attempts).toBe(0);
    expect(r.jobIdsTried).toEqual([]);
    expect(r.parallel).toBe(1);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("processes until cap or empty and counts claimed runs", async () => {
    claimMock
      .mockResolvedValueOnce({ id: "a", tenantId: "t1" })
      .mockResolvedValueOnce({ id: "b", tenantId: "t1" })
      .mockResolvedValue(null);
    executeMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(5);
    expect(r.attempts).toBe(2);
    expect(r.claimedAndFinished).toBe(1);
    expect(r.jobIdsTried).toEqual(["a", "b"]);
    expect(executeMock).toHaveBeenNthCalledWith(1, "a", "t1");
    expect(executeMock).toHaveBeenNthCalledWith(2, "b", "t1");
  });

  it("clamps limit to max", async () => {
    claimMock.mockResolvedValue({ id: "j-repeat", tenantId: "t1" });
    executeMock.mockResolvedValue(true);
    const { runApiHubMappingAnalysisWorkerSweep, APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT } = await import(
      "./mapping-analysis-job-worker-sweep"
    );
    await runApiHubMappingAnalysisWorkerSweep(999);
    expect(executeMock).toHaveBeenCalledTimes(APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT);
    expect(claimMock.mock.calls.length).toBe(APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT);
  });

  it("reclaims stale processing jobs before draining queued", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 3 });
    claimMock.mockResolvedValue(null);
    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(5);
    expect(r.reclaimedStale).toBe(3);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(r.claimedAndFinished).toBe(0);
  });

  it("uses APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL for batch size (capped)", async () => {
    process.env.APIHUB_MAPPING_ANALYSIS_WORKER_PARALLEL = "2";
    claimMock
      .mockResolvedValueOnce({ id: "x", tenantId: "t1" })
      .mockResolvedValueOnce({ id: "y", tenantId: "t1" })
      .mockResolvedValueOnce({ id: "z", tenantId: "t1" })
      .mockResolvedValueOnce(null)
      .mockResolvedValue(null);
    executeMock.mockResolvedValue(true);
    const { runApiHubMappingAnalysisWorkerSweep } = await import("./mapping-analysis-job-worker-sweep");
    const r = await runApiHubMappingAnalysisWorkerSweep(3);
    expect(r.parallel).toBe(2);
    expect(r.attempts).toBe(3);
    expect(r.jobIdsTried).toEqual(["x", "y", "z"]);
  });
});
