import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiHubStagingBatchRow, ApiHubStagingRowEntity } from "@/lib/apihub/staging-batches-repo";

const h = vi.hoisted(() => ({
  getRows: vi.fn(),
  dryRun: vi.fn(),
  applyInTx: vi.fn(),
  txUpdate: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/apihub/staging-batches-repo", () => ({
  getApiHubStagingBatchWithRows: h.getRows,
}));

vi.mock("@/lib/apihub/downstream-mapped-rows-apply", () => ({
  applyMappedRowsInTransaction: h.applyInTx,
  dryRunMappedRowsPreview: h.dryRun,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: h.$transaction,
  },
}));

function makeOpenBatchWithOneRow(tenantId: string, batchId: string): {
  batch: ApiHubStagingBatchRow;
  rows: ApiHubStagingRowEntity[];
} {
  const now = new Date("2026-04-22T12:00:00.000Z");
  return {
    batch: {
      id: batchId,
      tenantId,
      createdByUserId: "u1",
      sourceMappingAnalysisJobId: null,
      title: null,
      status: "open",
      rowCount: 1,
      appliedAt: null,
      applySummary: null,
      createdAt: now,
      updatedAt: now,
    },
    rows: [
      {
        id: "row-1",
        tenantId,
        batchId,
        rowIndex: 0,
        sourceRecord: {},
        mappedRecord: { kind: "purchase_order" },
        issues: null,
        createdAt: now,
      },
    ],
  };
}

describe("staging-batch-apply tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getRows.mockResolvedValue(makeOpenBatchWithOneRow("tenant-stg", "batch-1"));
    h.dryRun.mockResolvedValue({
      target: "purchase_order",
      dryRun: true,
      rows: [{ rowIndex: 0, ok: true }],
    });
    h.applyInTx.mockResolvedValue({
      target: "purchase_order",
      dryRun: false,
      rows: [{ rowIndex: 0, ok: true }],
    });
    h.txUpdate.mockResolvedValue({});
    h.$transaction.mockImplementation(
      async (fn: (tx: { apiHubStagingBatch: { update: typeof h.txUpdate } }) => Promise<unknown>) =>
        fn({
          apiHubStagingBatch: {
            update: h.txUpdate,
          },
        }),
    );
  });

  it("passes tenantId into getApiHubStagingBatchWithRows and dryRunMappedRowsPreview", async () => {
    const { applyApiHubStagingBatchToDownstream } = await import("./staging-batch-apply");
    const out = await applyApiHubStagingBatchToDownstream({
      tenantId: "tenant-stg-dry",
      batchId: "batch-1",
      actorUserId: "actor-1",
      target: "purchase_order",
      dryRun: true,
    });
    expect(out.ok).toBe(true);
    expect(h.getRows).toHaveBeenCalledWith({
      tenantId: "tenant-stg-dry",
      batchId: "batch-1",
      rowLimit: expect.any(Number) as unknown,
    });
    expect(h.dryRun).toHaveBeenCalledWith({
      tenantId: "tenant-stg-dry",
      target: "purchase_order",
      rows: [
        {
          rowIndex: 0,
          mappedRecord: { kind: "purchase_order" },
          stagingRowId: "row-1",
        },
      ],
    });
    expect(h.$transaction).not.toHaveBeenCalled();
  });

  it("passes tenantId into applyMappedRowsInTransaction and staging batch update where", async () => {
    h.getRows.mockResolvedValue(makeOpenBatchWithOneRow("tenant-stg-wet", "batch-1"));
    const { applyApiHubStagingBatchToDownstream } = await import("./staging-batch-apply");
    const out = await applyApiHubStagingBatchToDownstream({
      tenantId: "tenant-stg-wet",
      batchId: "batch-1",
      actorUserId: "actor-1",
      target: "purchase_order",
      dryRun: false,
    });
    expect(out.ok).toBe(true);
    expect(h.applyInTx).toHaveBeenCalledWith(
      expect.any(Object) as unknown,
      expect.objectContaining({
        tenantId: "tenant-stg-wet",
        actorUserId: "actor-1",
        target: "purchase_order",
        ctSource: { kind: "staging_batch", batchId: "batch-1" },
        salesOrderExternalRefPolicy: "ignore",
        purchaseOrderBuyerRefPolicy: "ignore",
      }),
    );
    expect(h.txUpdate).toHaveBeenCalledWith({
      where: { id: "batch-1", tenantId: "tenant-stg-wet" },
      data: expect.objectContaining({
        status: "promoted",
        appliedAt: expect.any(Date) as unknown,
        applySummary: expect.any(Object) as unknown,
      }),
    });
  });
});
