import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubMappingAnalysisJob: {
      updateMany: updateManyMock,
    },
  },
}));

describe("reclaimStaleApiHubMappingAnalysisJobs", () => {
  const prevStale = process.env.APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS;
    updateManyMock.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (prevStale === undefined) delete process.env.APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS;
    else process.env.APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS = prevStale;
  });

  it("uses default 15m cutoff from fixed now", async () => {
    const { reclaimStaleApiHubMappingAnalysisJobs, APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS_DEFAULT } =
      await import("./mapping-analysis-job-worker-sweep");
    const now = new Date("2026-04-22T12:00:00.000Z");
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    const n = await reclaimStaleApiHubMappingAnalysisJobs(now);
    expect(n).toBe(1);
    const call = updateManyMock.mock.calls[0]?.[0] as {
      where: { OR: Array<{ startedAt?: { lt: Date } } | { startedAt: null }> };
    };
    expect(call.where.OR).toEqual(
      expect.arrayContaining([{ startedAt: { lt: new Date(now.getTime() - APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS_DEFAULT) } }, { startedAt: null }]),
    );
    expect(call.where.OR).toHaveLength(2);
  });

  it("respects APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS when set", async () => {
    process.env.APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS = "120000";
    const { reclaimStaleApiHubMappingAnalysisJobs } = await import("./mapping-analysis-job-worker-sweep");
    const now = new Date("2026-04-22T12:00:00.000Z");
    await reclaimStaleApiHubMappingAnalysisJobs(now);
    const call = updateManyMock.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(call.where.OR[0]).toEqual({ startedAt: { lt: new Date(now.getTime() - 120_000) } });
  });
});
