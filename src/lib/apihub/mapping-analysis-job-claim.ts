import { prisma } from "@/lib/prisma";

export type ClaimedApiHubMappingAnalysisJob = {
  id: string;
  tenantId: string;
};

/**
 * Atomically claims the oldest **queued** mapping-analysis job using `FOR UPDATE SKIP LOCKED` so concurrent
 * workers (multiple cron instances, `after()` + cron, or parallel drain) never claim the same row.
 */
export async function claimNextQueuedApiHubMappingAnalysisJob(): Promise<ClaimedApiHubMappingAnalysisJob | null> {
  const rows = await prisma.$queryRaw<ClaimedApiHubMappingAnalysisJob[]>`
    WITH picked AS (
      SELECT "id"
      FROM "ApiHubMappingAnalysisJob"
      WHERE "status" = 'queued'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "ApiHubMappingAnalysisJob" AS j
    SET "status" = 'processing', "startedAt" = CURRENT_TIMESTAMP
    FROM picked
    WHERE j."id" = picked."id"
    RETURNING j."id", j."tenantId"
  `;
  return rows[0] ?? null;
}
