import {
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { API_HUB_APPLY_ROLLBACK_STUB_ROLLBACK } from "@/lib/apihub/ingestion-apply-rollback-contract";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { getApiHubIngestionRunById } from "@/lib/apihub/ingestion-runs-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

/**
 * Stub apply rollback — documents the response contract and returns the current run.
 * Does not clear `appliedAt` or touch downstream systems (Slice 44).
 */
export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "standard", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { jobId } = await context.params;
  const run = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!run) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }

  return apiHubJson(
    {
      rollback: API_HUB_APPLY_ROLLBACK_STUB_ROLLBACK,
      run: toApiHubIngestionRunDto(run),
    },
    requestId,
    200,
  );
}
