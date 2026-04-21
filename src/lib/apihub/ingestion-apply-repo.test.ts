import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  anchorFind: vi.fn(),
  txUpdateMany: vi.fn(),
  txFindFirst: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubIngestionRun: {
      findFirst: h.anchorFind,
    },
    $transaction: h.$transaction,
  },
}));

import { prisma } from "@/lib/prisma";

import { applyApiHubIngestionRun } from "./ingestion-apply-repo";

const fullRow = {
  id: "run-1",
  connectorId: "c1",
  requestedByUserId: "u1",
  idempotencyKey: null,
  status: "succeeded",
  triggerKind: "api",
  attempt: 1,
  maxAttempts: 3,
  resultSummary: null,
  errorCode: null,
  errorMessage: null,
  enqueuedAt: new Date("2026-04-22T10:00:00.000Z"),
  startedAt: new Date("2026-04-22T10:00:01.000Z"),
  finishedAt: new Date("2026-04-22T10:00:10.000Z"),
  retryOfRunId: null,
  appliedAt: new Date("2026-04-22T10:00:11.000Z"),
  createdAt: new Date("2026-04-22T10:00:00.000Z"),
  updatedAt: new Date("2026-04-22T10:00:11.000Z"),
};

describe("applyApiHubIngestionRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({
        apiHubIngestionRun: { updateMany: h.txUpdateMany, findFirst: h.txFindFirst },
      }),
    );
  });

  it("returns null when run is missing", async () => {
    h.anchorFind.mockResolvedValue(null);
    expect(await applyApiHubIngestionRun({ tenantId: "t1", runId: "missing" })).toBeNull();
  });

  it("returns blocked when connector is missing", async () => {
    h.anchorFind.mockResolvedValue({
      id: "run-1",
      connectorId: "c1",
      status: "succeeded",
      appliedAt: null,
      connector: null,
    });
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({ kind: "blocked", reason: "connector_not_found" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns blocked when connector is not active", async () => {
    h.anchorFind.mockResolvedValue({
      id: "run-1",
      connectorId: "c1",
      status: "succeeded",
      appliedAt: null,
      connector: { id: "c1", status: "paused" },
    });
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({
      kind: "blocked",
      reason: "connector_not_active",
      connectorStatus: "paused",
    });
  });

  it("returns not_succeeded when run has not finished successfully", async () => {
    h.anchorFind.mockResolvedValue({
      id: "run-1",
      connectorId: null,
      status: "running",
      appliedAt: null,
      connector: null,
    });
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({ kind: "not_succeeded", status: "running" });
  });

  it("returns already_applied when appliedAt is set", async () => {
    h.anchorFind.mockResolvedValueOnce({
      id: "run-1",
      connectorId: null,
      status: "succeeded",
      appliedAt: new Date(),
      connector: null,
    });
    h.anchorFind.mockResolvedValueOnce(fullRow);
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({ kind: "already_applied", run: fullRow });
  });

  it("applies with conditional update and returns full row", async () => {
    h.anchorFind.mockResolvedValue({
      id: "run-1",
      connectorId: null,
      status: "succeeded",
      appliedAt: null,
      connector: null,
    });
    h.txUpdateMany.mockResolvedValue({ count: 1 });
    h.txFindFirst.mockResolvedValue(fullRow);
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({ kind: "applied", run: fullRow });
    expect(h.txUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", id: "run-1", status: "succeeded", appliedAt: null },
      }),
    );
  });

  it("returns not_succeeded when status changes before conditional update", async () => {
    h.anchorFind.mockResolvedValue({
      id: "run-1",
      connectorId: null,
      status: "succeeded",
      appliedAt: null,
      connector: null,
    });
    h.txUpdateMany.mockResolvedValue({ count: 0 });
    h.txFindFirst.mockResolvedValueOnce({ status: "failed", appliedAt: null });
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({ kind: "not_succeeded", status: "failed" });
  });

  it("returns already_applied when conditional update races", async () => {
    h.anchorFind.mockResolvedValue({
      id: "run-1",
      connectorId: null,
      status: "succeeded",
      appliedAt: null,
      connector: null,
    });
    h.txUpdateMany.mockResolvedValue({ count: 0 });
    h.txFindFirst
      .mockResolvedValueOnce({ status: "succeeded", appliedAt: new Date("2026-04-22T10:00:11.000Z") })
      .mockResolvedValueOnce(fullRow);
    const out = await applyApiHubIngestionRun({ tenantId: "t1", runId: "run-1" });
    expect(out).toEqual({ kind: "already_applied", run: fullRow });
  });
});
