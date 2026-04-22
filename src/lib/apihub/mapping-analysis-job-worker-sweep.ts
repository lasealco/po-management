import { processApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-job-process";
import { prisma } from "@/lib/prisma";

/** Default jobs attempted per cron invocation (each may no-op if lost a claim race). */
export const APIHUB_MAPPING_ANALYSIS_WORKER_DEFAULT_LIMIT = 5;
/** Hard cap per invocation to bound LLM / CPU time in one HTTP request. */
export const APIHUB_MAPPING_ANALYSIS_WORKER_MAX_LIMIT = 20;

export type ApiHubMappingAnalysisWorkerSweepResult = {
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

  return { claimedAndFinished, attempts, jobIdsTried };
}
