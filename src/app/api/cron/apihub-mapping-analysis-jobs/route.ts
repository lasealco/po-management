import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { reclaimStaleApiHubIngestionRuns } from "@/lib/apihub/ingestion-run-stale-reclaim";
import { runApiHubMappingAnalysisWorkerSweep } from "@/lib/apihub/mapping-analysis-job-worker-sweep";

export const dynamic = "force-dynamic";

/**
 * ApiHub **cron**: fails stale **`running`** ingestion runs, requeues stale **`processing`** mapping-analysis jobs,
 * then drains mapping-analysis **`queued`** (when `after()` does not run on serverless). Same auth as other crons.
 *
 * Secure with `CRON_SECRET`: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Optional query: `limit` (1–20 mapping-analysis jobs per sweep, default 5).
 *
 * Stale thresholds: **`APIHUB_INGESTION_RUN_STALE_RUNNING_MS`** (ms, default **24h**, clamped **1m–7d**);
 * **`APIHUB_MAPPING_ANALYSIS_STALE_PROCESSING_MS`** (ms, default **15m**, clamped **1m–24h**).
 *
 * Configure in `vercel.json` (Pro: sub-hourly; Hobby: may run at most once per day — still drains backlog when it fires).
 */
async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return toApiErrorResponse({ error: "CRON_SECRET is not configured.", code: "UNAVAILABLE", status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return toApiErrorResponse({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 });
  }

  let limit: number | undefined;
  try {
    const raw = new URL(request.url).searchParams.get("limit");
    if (raw != null && raw.trim() !== "") {
      limit = Number(raw);
    }
  } catch {
    limit = undefined;
  }

  const reclaimedStaleIngestionRuns = await reclaimStaleApiHubIngestionRuns();
  const summary = await runApiHubMappingAnalysisWorkerSweep(limit);
  return NextResponse.json({ ok: true, reclaimedStaleIngestionRuns, ...summary });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
