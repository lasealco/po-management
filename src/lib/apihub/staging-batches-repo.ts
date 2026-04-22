import type { Prisma } from "@prisma/client";

import { APIHUB_STAGING_BATCH_MAX_ROWS } from "@/lib/apihub/constants";
import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";
import { applyApiHubMappingRulesBatch } from "@/lib/apihub/mapping-engine";
import { prisma } from "@/lib/prisma";

const batchSelect = {
  id: true,
  tenantId: true,
  createdByUserId: true,
  sourceMappingAnalysisJobId: true,
  title: true,
  status: true,
  rowCount: true,
  appliedAt: true,
  applySummary: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ApiHubStagingBatchRow = {
  id: string;
  tenantId: string;
  createdByUserId: string;
  sourceMappingAnalysisJobId: string | null;
  title: string | null;
  status: string;
  rowCount: number;
  appliedAt: Date | null;
  applySummary: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

const rowSelect = {
  id: true,
  tenantId: true,
  batchId: true,
  rowIndex: true,
  sourceRecord: true,
  mappedRecord: true,
  issues: true,
  createdAt: true,
} as const;

export type ApiHubStagingRowEntity = {
  id: string;
  tenantId: string;
  batchId: string;
  rowIndex: number;
  sourceRecord: Prisma.JsonValue | null;
  mappedRecord: Prisma.JsonValue | null;
  issues: Prisma.JsonValue | null;
  createdAt: Date;
};

export async function createApiHubStagingBatchFromAnalysisJob(input: {
  tenantId: string;
  actorUserId: string;
  mappingAnalysisJobId: string;
  title: string | null;
}): Promise<ApiHubStagingBatchRow> {
  const job = await prisma.apiHubMappingAnalysisJob.findFirst({
    where: { id: input.mappingAnalysisJobId, tenantId: input.tenantId, status: "succeeded" },
  });
  if (!job?.outputProposal) {
    throw new Error("Analysis job not found, wrong tenant, or not succeeded.");
  }

  const inputPayload = job.inputPayload as { records?: unknown };
  const outputProposal = job.outputProposal as { rules?: unknown };
  const recordsRaw = inputPayload.records;
  if (!Array.isArray(recordsRaw)) {
    throw new Error("Job input has no records array.");
  }
  const rulesRaw = outputProposal.rules;
  if (!Array.isArray(rulesRaw)) {
    throw new Error("Job output has no rules array.");
  }

  if (recordsRaw.length > APIHUB_STAGING_BATCH_MAX_ROWS) {
    throw new Error(`At most ${APIHUB_STAGING_BATCH_MAX_ROWS} rows per staging batch.`);
  }

  const applied = applyApiHubMappingRulesBatch(recordsRaw, rulesRaw as ApiHubMappingRule[]);

  return prisma.$transaction(async (tx) => {
    const batch = await tx.apiHubStagingBatch.create({
      data: {
        tenantId: input.tenantId,
        createdByUserId: input.actorUserId,
        sourceMappingAnalysisJobId: job.id,
        title: input.title,
        status: "open",
        rowCount: applied.length,
      },
      select: batchSelect,
    });

    if (applied.length > 0) {
      await tx.apiHubStagingRow.createMany({
        data: applied.map((row, idx) => ({
          tenantId: input.tenantId,
          batchId: batch.id,
          rowIndex: idx,
          sourceRecord: JSON.parse(JSON.stringify(recordsRaw[idx] ?? null)) as Prisma.InputJsonValue,
          mappedRecord: JSON.parse(JSON.stringify(row.mapped)) as Prisma.InputJsonValue,
          issues: JSON.parse(JSON.stringify(row.issues)) as Prisma.InputJsonValue,
        })),
      });
    }

    return batch;
  });
}

export async function listApiHubStagingBatches(input: { tenantId: string; limit: number }): Promise<ApiHubStagingBatchRow[]> {
  return prisma.apiHubStagingBatch.findMany({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: "desc" },
    take: input.limit,
    select: batchSelect,
  });
}

export async function getApiHubStagingBatchWithRows(input: {
  tenantId: string;
  batchId: string;
  rowLimit: number;
}): Promise<{ batch: ApiHubStagingBatchRow; rows: ApiHubStagingRowEntity[] } | null> {
  const batch = await prisma.apiHubStagingBatch.findFirst({
    where: { id: input.batchId, tenantId: input.tenantId },
    select: batchSelect,
  });
  if (!batch) {
    return null;
  }
  const rows = await prisma.apiHubStagingRow.findMany({
    where: { tenantId: input.tenantId, batchId: input.batchId },
    orderBy: { rowIndex: "asc" },
    take: input.rowLimit,
    select: rowSelect,
  });
  return { batch, rows };
}
