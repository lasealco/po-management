import { prisma } from "@/lib/prisma";

import {
  buildSortedIngestionRunTimelineEvents,
  paginateIngestionRunTimelineEvents,
  type ApiHubIngestionRunTimelineEvent,
  type ApiHubIngestionRunTimelineSourceRow,
} from "@/lib/apihub/ingestion-run-timeline";

const TIMELINE_RUN_SELECT = {
  id: true,
  attempt: true,
  status: true,
  enqueuedAt: true,
  startedAt: true,
  finishedAt: true,
  retryOfRunId: true,
} as const;

/**
 * Collects the anchor run's retry tree (root + all descendants) for a tenant, then builds a merged
 * chronological timeline with server-side pagination over the derived event list.
 */
export async function getApiHubIngestionRunTimelinePage(opts: {
  tenantId: string;
  runId: string;
  limit: number;
  cursorOffset: number;
}): Promise<{ items: ApiHubIngestionRunTimelineEvent[]; nextCursor: string | null } | null> {
  const anchor = await prisma.apiHubIngestionRun.findFirst({
    where: { tenantId: opts.tenantId, id: opts.runId },
    select: { id: true, retryOfRunId: true },
  });
  if (!anchor) return null;

  let root = anchor;
  for (let depth = 0; depth < 32 && root.retryOfRunId; depth += 1) {
    const parent = await prisma.apiHubIngestionRun.findFirst({
      where: { tenantId: opts.tenantId, id: root.retryOfRunId },
      select: { id: true, retryOfRunId: true },
    });
    if (!parent) break;
    root = parent;
  }

  const ids = new Set<string>([root.id]);
  let frontier = [root.id];
  for (let wave = 0; wave < 32 && frontier.length > 0; wave += 1) {
    const children = await prisma.apiHubIngestionRun.findMany({
      where: { tenantId: opts.tenantId, retryOfRunId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const c of children) {
      if (!ids.has(c.id)) {
        ids.add(c.id);
        frontier.push(c.id);
      }
    }
  }

  const rows = await prisma.apiHubIngestionRun.findMany({
    where: { tenantId: opts.tenantId, id: { in: [...ids] } },
    select: TIMELINE_RUN_SELECT,
  });

  const sources: ApiHubIngestionRunTimelineSourceRow[] = rows.map((r) => ({
    id: r.id,
    attempt: r.attempt,
    status: r.status,
    enqueuedAt: r.enqueuedAt,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  }));

  const sorted = buildSortedIngestionRunTimelineEvents(sources);
  return paginateIngestionRunTimelineEvents(sorted, opts.cursorOffset, opts.limit);
}
