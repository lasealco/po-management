import { prisma } from "@/lib/prisma";

import { APIHUB_INGESTION_ERROR_STALE_RUNNING } from "./constants";

/**
 * Default age after which `running` ingestion runs are failed for retry (lost client / abandoned tab).
 * Intentionally **longer** than mapping-analysis reclaim: these rows track operator/API workflows that may
 * stay `running` for hours. Tune down with **`APIHUB_INGESTION_RUN_STALE_RUNNING_MS`** if you want stricter reclaim.
 */
export const APIHUB_INGESTION_RUN_STALE_RUNNING_MS_DEFAULT = 24 * 60 * 60 * 1000;
/** Upper bound for `APIHUB_INGESTION_RUN_STALE_RUNNING_MS` (mapping-analysis reclaim stays capped at 24h separately). */
export const APIHUB_INGESTION_RUN_STALE_RUNNING_MS_CAP = 7 * 24 * 60 * 60 * 1000;
const STALE_MS_MIN = 60 * 1000;

const STALE_RUNNING_MESSAGE =
  "Run stayed in running past the stale threshold (worker timeout or crash). Marked failed for retry.";

function readStaleRunningMs(): number {
  const raw = process.env.APIHUB_INGESTION_RUN_STALE_RUNNING_MS;
  if (raw == null || String(raw).trim() === "") {
    return APIHUB_INGESTION_RUN_STALE_RUNNING_MS_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return APIHUB_INGESTION_RUN_STALE_RUNNING_MS_DEFAULT;
  }
  return Math.min(APIHUB_INGESTION_RUN_STALE_RUNNING_MS_CAP, Math.max(STALE_MS_MIN, Math.floor(n)));
}

/**
 * Ingestion runs left in `running` (e.g. Lambda freeze, client disconnect) never complete. Mark them **`failed`**
 * so operators can use **`POST …/retry`** (same as other terminal failures). `startedAt` older than the stale
 * threshold, or null while still running, triggers reclaim.
 *
 * Optional `now` for tests. Threshold: **`APIHUB_INGESTION_RUN_STALE_RUNNING_MS`** (milliseconds, default 24h, clamped 1m–7d).
 */
export async function reclaimStaleApiHubIngestionRuns(now?: Date): Promise<number> {
  const clock = now ?? new Date();
  const cutoff = new Date(clock.getTime() - readStaleRunningMs());
  const r = await prisma.apiHubIngestionRun.updateMany({
    where: {
      status: "running",
      OR: [{ startedAt: { lt: cutoff } }, { startedAt: null }],
    },
    data: {
      status: "failed",
      finishedAt: clock,
      errorCode: APIHUB_INGESTION_ERROR_STALE_RUNNING,
      errorMessage: STALE_RUNNING_MESSAGE,
      resultSummary: null,
    },
  });
  return r.count;
}
