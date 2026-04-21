import {
  APIHUB_INGESTION_JOB_STATUSES,
  type ApiHubIngestionJobStatus,
} from "@/lib/apihub/constants";

/** Per-status counts for ingestion runs (tenant-wide). */
export type ApiHubIngestionRunOpsByStatus = Record<ApiHubIngestionJobStatus, number>;

export function emptyIngestionRunOpsByStatus(): ApiHubIngestionRunOpsByStatus {
  return {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
  };
}

type GroupRow = { status: string; _count: { _all: number } };

/** Normalizes Prisma `groupBy` rows into a fixed status map (unknown statuses ignored). */
export function ingestionRunOpsFromGroupBy(rows: GroupRow[]): ApiHubIngestionRunOpsByStatus {
  const out = emptyIngestionRunOpsByStatus();
  const allow = new Set<string>(APIHUB_INGESTION_JOB_STATUSES);
  for (const row of rows) {
    if (allow.has(row.status)) {
      out[row.status as ApiHubIngestionJobStatus] = row._count._all;
    }
  }
  return out;
}

export function sumIngestionRunOpsByStatus(counts: ApiHubIngestionRunOpsByStatus): number {
  return (
    counts.queued + counts.running + counts.succeeded + counts.failed
  );
}
