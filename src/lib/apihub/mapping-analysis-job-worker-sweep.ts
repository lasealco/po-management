import { processApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-job-process";
import { prisma } from "@/lib/prisma";

/** Default jobs attempted per cron invocation (each may no-op if lost a claim race). */
export const APIHUB_MAPPING_ANALYSIS_WORKER_DEFAULT_LIMIT = 5;
/** Hard cap per invocation to bound LLM / CPU time in one HTTP request. */
export const APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT = 20;

/** Default age after which `processing` jobs are reset to `queued` (serverless crash / timeout). */
export const APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS_DEFAULT = 15 * 60 * 1000;
const STALE_MS_MIN = 60 * 1000;
const STALE_MS_MAX = 24 * 60 * 60 * 1000;

function readStaleProcessingMs(): number {
  const raw = process.env.APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS;
  if (raw == null || String(raw).trim() === "") {
    return APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS_DEFAULT;
  }
  return Math.min(STALE_MS_MAX, Math.max(STALE_MS_MIN, Math.floor(n)));
}

/**
 * Jobs left in `processing` (e.g. Lambda freeze, OOM, deploy) never complete. Reset them to `queued` so the
 * cron sweep can pick them up again. `startedAt` older than the stale threshold, or null while still processing,
 * triggers reclaim.
 *
 * Optional `now` for tests. Threshold: `APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS` (milliseconds, default 15m).
 */
export async function reclaimStaleApiHubMappingAnalysisJobs(now?: Date): Promise<number> {
  const clock = now ?? new Date();
  const cutoff = new Date(clock.getTime() - readStaleProcessingMs());
  const r = await prisma.apiHubMappingAnalysisJob.updateMany({
    where: {
      status: "processing",
      OR: [{ startedAt: { lt: cutoff } }, { startedAt: null }],
    },
    data: {
      status: "queued",
      startedAt: null,
    },
  });
  return r.count;
}

export type ApiHubMappingAnalysisWorkerSweepResult = {
  /** Jobs reset from stale `processing` → `queued` before draining the queue. */
  reclaimedStale: number;
  /** Jobs for which `processApiHubMappingAnalysisJob` returned `true` (claimed and finished). */
  claimedAndFinished: number;
  /** Jobs we attempted (`findFirst` returned queued); includes races where claim was lost. */
  attempts: number;
  /** Job ids passed to `process` in order (for observability). */
  jobIdsTried: string[];
};

function clampWorkerLimit(raw: number | undefined): number {
  const n = raw == null || !Number.isFinite(raw) ? APIHUB_MAPPING_ANALYSIS_WORKER_DEFAULT_LIMIT : Math.floor(raw);
  return Math.min(APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT, Math.max(1, n));
}

/**
 * R2 — drain **queued** mapping analysis jobs (oldest first). Uses the same processor as `after()` and
 * `POST …/process`; atomic claim inside `processApiHubMappingAnalysisJob` avoids double execution.
 */
export async function runApiHubMappingAnalysisWorkerSweep(
  limit?: number,
): Promise<ApiHubMappingAnalysisWorkerSweepResult> {
  const reclaimedStale = await reclaimStaleApiHubMappingAnalysisJobs();
  const cap = clampWorkerLimit(limit);
  const jobIdsTried: string[] = [];
  let claimedAndFinished = 0;
  let attempts = 0;

  for (let i = 0; i < cap; i++) {
    const next = await prisma.apiHubMappingAnalysisJob.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      select: { id: true, tenantId: true },
    });
    if (!next) {
      break;
    }
    attempts += 1;
    jobIdsTried.push(next.id);
    const ran = await processApiHubMappingAnalysisJob(next.id, next.tenantId);
    if (ran) {
      claimedAndFinished += 1;
    }
  }

  return { reclaimedStale, claimedAndFinished, attempts, jobIdsTried };
}
