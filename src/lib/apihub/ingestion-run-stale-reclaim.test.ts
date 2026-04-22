import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_INGESTION_ERROR_STALE_RUNNING } from "./constants";

const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubIngestionRun: {
      updateMany: updateManyMock,
    },
  },
}));

describe("reclaimStaleApiHubIngestionRuns", () => {
  const prevStale = process.env.APIHUB_INGESTION_RUN_STALE_RUNNING_MS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APIHUB_INGESTION_RUN_STALE_RUNNING_MS;
    updateManyMock.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (prevStale === undefined) delete process.env.APIHUB_INGESTION_RUN_STALE_RUNNING_MS;
    else process.env.APIHUB_INGESTION_RUN_STALE_RUNNING_MS = prevStale;
  });

  it("uses default 15m cutoff from fixed now and sets stable error code", async () => {
    const { reclaimStaleApiHubIngestionRuns, APIHUB_INGESTION_RUN_STALE_RUNNING_MS_DEFAULT } =
      await import("./ingestion-run-stale-reclaim");
    const now = new Date("2026-04-22T12:00:00.000Z");
    updateManyMock.mockResolvedValueOnce({ count: 2 });
    const n = await reclaimStaleApiHubIngestionRuns(now);
    expect(n).toBe(2);
    const call = updateManyMock.mock.calls[0]?.[0] as {
      where: { status: string; OR: Array<{ startedAt?: { lt: Date } } | { startedAt: null }> };
      data: { status: string; errorCode: string; finishedAt: Date };
    };
    expect(call.where.status).toBe("running");
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        { startedAt: { lt: new Date(now.getTime() - APIHUB_INGESTION_RUN_STALE_RUNNING_MS_DEFAULT) } },
        { startedAt: null },
      ]),
    );
    expect(call.where.OR).toHaveLength(2);
    expect(call.data.status).toBe("failed");
    expect(call.data.errorCode).toBe(APIHUB_INGESTION_ERROR_STALE_RUNNING);
    expect(call.data.finishedAt).toEqual(now);
  });

  it("respects APIHUB_INGESTION_RUN_STALE_RUNNING_MS when set", async () => {
    process.env.APIHUB_INGESTION_RUN_STALE_RUNNING_MS = "180000";
    const { reclaimStaleApiHubIngestionRuns } = await import("./ingestion-run-stale-reclaim");
    const now = new Date("2026-04-22T12:00:00.000Z");
    await reclaimStaleApiHubIngestionRuns(now);
    const call = updateManyMock.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(call.where.OR[0]).toEqual({ startedAt: { lt: new Date(now.getTime() - 180_000) } });
  });
});
