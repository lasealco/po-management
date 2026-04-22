import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { toApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";
import { processApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-job-process";
import { getApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-jobs-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/**
 * Manually (re)process a **queued** job — useful for local dev/tests when `after()` is not observed,
 * or to retry after infra issues. Idempotent: only jobs in `queued` are claimed.
 */
export async function POST(request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const { jobId } = await ctx.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const existing = await getApiHubMappingAnalysisJob({ tenantId: tenant.id, jobId });
  if (!existing) {
    return apiHubError(404, "NOT_FOUND", "Mapping analysis job not found.", requestId);
  }

  await processApiHubMappingAnalysisJob(jobId, tenant.id);

  const row = await getApiHubMappingAnalysisJob({ tenantId: tenant.id, jobId });
  if (!row) {
    return apiHubError(404, "NOT_FOUND", "Mapping analysis job not found.", requestId);
  }

  return apiHubJson({ job: toApiHubMappingAnalysisJobDto(row) }, requestId);
}
