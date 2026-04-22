import type { ApiHubStagingBatchRow, ApiHubStagingRowEntity } from "@/lib/apihub/staging-batches-repo";

export type ApiHubStagingBatchListItemDto = {
  id: string;
  status: string;
  rowCount: number;
  title: string | null;
  sourceMappingAnalysisJobId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type ApiHubStagingRowDto = {
  rowIndex: number;
  sourceRecord: unknown;
  mappedRecord: unknown;
  issues: unknown;
};

export type ApiHubStagingBatchDetailDto = ApiHubStagingBatchListItemDto & {
  rows: ApiHubStagingRowDto[];
};

export function toApiHubStagingBatchListItemDto(row: ApiHubStagingBatchRow): ApiHubStagingBatchListItemDto {
  return {
    id: row.id,
    status: row.status,
    rowCount: row.rowCount,
    title: row.title,
    sourceMappingAnalysisJobId: row.sourceMappingAnalysisJobId,
    appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toApiHubStagingBatchDetailDto(
  batch: ApiHubStagingBatchRow,
  rows: ApiHubStagingRowEntity[],
): ApiHubStagingBatchDetailDto {
  return {
    ...toApiHubStagingBatchListItemDto(batch),
    rows: rows.map((r) => ({
      rowIndex: r.rowIndex,
      sourceRecord: r.sourceRecord ?? null,
      mappedRecord: r.mappedRecord ?? null,
      issues: r.issues ?? null,
    })),
  };
}
