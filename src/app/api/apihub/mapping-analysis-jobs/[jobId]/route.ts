import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { toApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";
import { getApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-jobs-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ jobId: string }> }) {
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

  const row = await getApiHubMappingAnalysisJob({ tenantId: tenant.id, jobId });
  if (!row) {
    return apiHubError(404, "NOT_FOUND", "Mapping analysis job not found.", requestId);
  }

  return apiHubJson({ job: toApiHubMappingAnalysisJobDto(row) }, requestId);
}
