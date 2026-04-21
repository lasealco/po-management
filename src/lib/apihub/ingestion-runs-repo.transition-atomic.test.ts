import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, findFirst } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

import { transitionApiHubIngestionRun } from "./ingestion-runs-repo";

describe("transitionApiHubIngestionRun atomic guard (Slice 26)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      (fn as (tx: unknown) => Promise<unknown>)({ apiHubIngestionRun: { updateMany, findFirst } }),
    );
  });

  it("scopes updateMany to tenant, id, and allowed source statuses", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue({
      id: "run-1",
      connectorId: null,
      requestedByUserId: "u1",
      idempotencyKey: null,
      status: "running",
      triggerKind: "api",
      attempt: 1,
      maxAttempts: 3,
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
      enqueuedAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      retryOfRunId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await transitionApiHubIngestionRun({
      tenantId: "t1",
      runId: "run-1",
      nextStatus: "running",
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", id: "run-1", status: { in: ["queued"] } },
        data: expect.objectContaining({ status: "running" }),
      }),
    );
  });

  it("returns null when run does not exist", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);

    const out = await transitionApiHubIngestionRun({
      tenantId: "t1",
      runId: "missing",
      nextStatus: "running",
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
    });

    expect(out).toBeNull();
  });

  it("rejects transition targets that are never reachable", async () => {
    await expect(
      transitionApiHubIngestionRun({
        tenantId: "t1",
        runId: "run-1",
        nextStatus: "queued",
        resultSummary: null,
        errorCode: null,
        errorMessage: null,
      }),
    ).rejects.toThrow("run_invalid_transition_target");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws when row exists but status no longer matches (race)", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue({ id: "run-1" });

    await expect(
      transitionApiHubIngestionRun({
        tenantId: "t1",
        runId: "run-1",
        nextStatus: "running",
        resultSummary: null,
        errorCode: null,
        errorMessage: null,
      }),
    ).rejects.toThrow("run_transition_stale");
  });
});
