import { encodeIngestionRunTimelineCursor } from "@/lib/apihub/ingestion-run-timeline-cursor";

export type ApiHubIngestionRunTimelineSourceRow = {
  id: string;
  attempt: number;
  status: string;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type ApiHubIngestionRunTimelineEvent = {
  runId: string;
  attempt: number;
  status: "queued" | "running" | "succeeded" | "failed";
  at: string;
};

const STATUS_SORT: Record<ApiHubIngestionRunTimelineEvent["status"], number> = {
  queued: 0,
  running: 1,
  succeeded: 2,
  failed: 3,
};

function compareEvents(a: ApiHubIngestionRunTimelineEvent & { _atMs: number }, b: typeof a): number {
  const dt = a._atMs - b._atMs;
  if (dt !== 0) return dt;
  if (a.attempt !== b.attempt) return a.attempt - b.attempt;
  const idCmp = a.runId.localeCompare(b.runId);
  if (idCmp !== 0) return idCmp;
  return STATUS_SORT[a.status] - STATUS_SORT[b.status];
}

/**
 * Derives a chronological status timeline from persisted run timestamps (retry tree rows merged).
 */
export function buildSortedIngestionRunTimelineEvents(
  rows: ApiHubIngestionRunTimelineSourceRow[],
): ApiHubIngestionRunTimelineEvent[] {
  const internal: (ApiHubIngestionRunTimelineEvent & { _atMs: number })[] = [];

  for (const row of rows) {
    internal.push({
      runId: row.id,
      attempt: row.attempt,
      status: "queued",
      at: row.enqueuedAt.toISOString(),
      _atMs: row.enqueuedAt.getTime(),
    });
    if (row.startedAt) {
      internal.push({
        runId: row.id,
        attempt: row.attempt,
        status: "running",
        at: row.startedAt.toISOString(),
        _atMs: row.startedAt.getTime(),
      });
    }
    if ((row.status === "succeeded" || row.status === "failed") && row.finishedAt) {
      internal.push({
        runId: row.id,
        attempt: row.attempt,
        status: row.status,
        at: row.finishedAt.toISOString(),
        _atMs: row.finishedAt.getTime(),
      });
    }
  }

  internal.sort(compareEvents);
  return internal.map((e) => ({
    runId: e.runId,
    attempt: e.attempt,
    status: e.status,
    at: e.at,
  }));
}

export function paginateIngestionRunTimelineEvents(
  sorted: ApiHubIngestionRunTimelineEvent[],
  offset: number,
  limit: number,
): { items: ApiHubIngestionRunTimelineEvent[]; nextCursor: string | null } {
  const safeOffset = Math.min(Math.max(offset, 0), sorted.length);
  const items = sorted.slice(safeOffset, safeOffset + limit);
  const nextOffset = safeOffset + items.length;
  const nextCursor = nextOffset < sorted.length ? encodeIngestionRunTimelineCursor(nextOffset) : null;
  return { items, nextCursor };
}
