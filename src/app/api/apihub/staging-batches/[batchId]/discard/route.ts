import { apiHubError, apiHubJson } from "@/lib/apihub/api-error";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { discardApiHubStagingBatch } from "@/lib/apihub/staging-batches-repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const requestId = resolveApiHubRequestId(req);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;
  const { batchId } = await ctx.params;

  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(req, requestId, "standard", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const result = await discardApiHubStagingBatch({ tenantId: tenant.id, batchId });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiHubError(404, "NOT_FOUND", "Staging batch not found.", requestId);
    }
    if (result.reason === "already_applied") {
      return apiHubError(409, "CONFLICT", "Cannot discard a batch that was already applied downstream.", requestId);
    }
    return apiHubError(409, "CONFLICT", `Batch cannot be discarded (status must be open).`, requestId);
  }

  return apiHubJson({ discarded: true, batchId }, requestId);
}
