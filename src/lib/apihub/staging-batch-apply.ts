import { Prisma } from "@prisma/client";

import { APIHUB_STAGING_BATCH_MAX_ROWS } from "@/lib/apihub/constants";
import type { ApiHubStagingApplyTarget } from "@/lib/apihub/constants";
import {
  applyMappedRowsInTransaction,
  dryRunMappedRowsPreview,
  type ApiHubMappedApplyRow,
  type ApiHubStagingApplyRowResult,
  type ApiHubStagingApplySummary,
} from "@/lib/apihub/downstream-mapped-rows-apply";
import { getApiHubStagingBatchWithRows } from "@/lib/apihub/staging-batches-repo";
import type { ApiHubStagingRowEntity } from "@/lib/apihub/staging-batches-repo";
import { prisma } from "@/lib/prisma";

export type { ApiHubStagingApplyRowResult, ApiHubStagingApplySummary };

function stagingEntityToMapped(row: ApiHubStagingRowEntity): ApiHubMappedApplyRow {
  return {
    rowIndex: row.rowIndex,
    mappedRecord: row.mappedRecord,
    stagingRowId: row.id,
  };
}

/**
 * Applies staging rows downstream. SO/PO ref policies are fixed to **`ignore`** (create-only; no upsert).
 * See `docs/apihub/downstream-apply-semantics.md`.
 */
export async function applyApiHubStagingBatchToDownstream(input: {
  tenantId: string;
  batchId: string;
  actorUserId: string;
  target: ApiHubStagingApplyTarget;
  dryRun: boolean;
}): Promise<
  | { ok: true; summary: ApiHubStagingApplySummary }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT" | "VALIDATION"; message: string }
> {
  const found = await getApiHubStagingBatchWithRows({
    tenantId: input.tenantId,
    batchId: input.batchId,
    rowLimit: APIHUB_STAGING_BATCH_MAX_ROWS,
  });
  if (!found) {
    return { ok: false, code: "NOT_FOUND", message: "Staging batch not found." };
  }
  const { batch, rows } = found;
  if (batch.status !== "open") {
    return { ok: false, code: "CONFLICT", message: `Batch is not open (status=${batch.status}).` };
  }
  if (batch.appliedAt) {
    return { ok: false, code: "CONFLICT", message: "Batch was already applied." };
  }
  if (rows.length === 0) {
    return { ok: false, code: "VALIDATION", message: "Staging batch has no rows." };
  }
  const sorted = [...rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const mappedRows = sorted.map(stagingEntityToMapped);

  if (input.dryRun) {
    const summary = await dryRunMappedRowsPreview({
      tenantId: input.tenantId,
      target: input.target,
      rows: mappedRows,
    });
    return { ok: true, summary };
  }

  try {
    const summary = await prisma.$transaction(async (tx) => {
      const pack = await applyMappedRowsInTransaction(tx, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        target: input.target,
        rows: mappedRows,
        ctSource: { kind: "staging_batch", batchId: input.batchId },
        salesOrderExternalRefPolicy: "ignore",
        purchaseOrderBuyerRefPolicy: "ignore",
      });
      await tx.apiHubStagingBatch.update({
        where: { id: input.batchId, tenantId: input.tenantId },
        data: {
          status: "promoted",
          appliedAt: new Date(),
          applySummary: JSON.parse(JSON.stringify(pack)) as Prisma.InputJsonValue,
        },
      });
      return pack;
    });
    return { ok: true, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed.";
    return { ok: false, code: "VALIDATION", message: msg };
  }
}
