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

const timelineRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "run-1",
  attempt: 1,
  status: "succeeded",
  enqueuedAt: new Date("2026-01-01T00:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
  retryOfRunId: null,
  ...overrides,
});

describe("ingestion-run-timeline-repo tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue({ id: "run-1", retryOfRunId: null });
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([timelineRow()]);
  });

  it("scopes anchor, BFS, and timeline fetch to tenantId", async () => {
    const { getApiHubIngestionRunTimelinePage } = await import("./ingestion-run-timeline-repo");
    await getApiHubIngestionRunTimelinePage({
      tenantId: "tenant-tl-1",
      runId: "run-1",
      limit: 10,
      cursorOffset: 0,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-tl-1", id: "run-1" },
      select: { id: true, retryOfRunId: true },
    });
    expect(findMany).toHaveBeenCalledTimes(2);
    for (const call of findMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-tl-1" }),
        }),
      );
    }
  });

  it("scopes parent-chain findFirst calls to tenantId", async () => {
    findFirst
      .mockResolvedValueOnce({ id: "run-child", retryOfRunId: "run-parent" })
      .mockResolvedValueOnce({ id: "run-parent", retryOfRunId: null });
    findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: "run-child" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        timelineRow({
          id: "run-parent",
          retryOfRunId: null,
        }),
        timelineRow({
          id: "run-child",
          attempt: 2,
          status: "failed",
          enqueuedAt: new Date("2026-01-02T00:00:00.000Z"),
          retryOfRunId: "run-parent",
        }),
      ]);

    const { getApiHubIngestionRunTimelinePage } = await import("./ingestion-run-timeline-repo");
    await getApiHubIngestionRunTimelinePage({
      tenantId: "tenant-tl-2",
      runId: "run-child",
      limit: 10,
      cursorOffset: 0,
    });

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenNthCalledWith(1, {
      where: { tenantId: "tenant-tl-2", id: "run-child" },
      select: { id: true, retryOfRunId: true },
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { tenantId: "tenant-tl-2", id: "run-parent" },
      select: { id: true, retryOfRunId: true },
    });
    expect(findMany).toHaveBeenCalledTimes(3);
    for (const call of findMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-tl-2" }),
        }),
      );
    }
  });
});
