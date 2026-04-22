import {
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { toApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";
import { getApiHubMappingAnalysisJob } from "@/lib/apihub/mapping-analysis-jobs-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const { jobId } = await ctx.params;
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const row = await getApiHubMappingAnalysisJob({ tenantId: tenant.id, jobId });
  if (!row) {
    return apiHubError(404, "NOT_FOUND", "Mapping analysis job not found.", requestId);
  }

  return apiHubJson({ job: toApiHubMappingAnalysisJobDto(row) }, requestId);
}
