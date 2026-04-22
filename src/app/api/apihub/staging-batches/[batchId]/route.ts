import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { APIHUB_STAGING_BATCH_DETAIL_ROW_LIMIT_MAX } from "@/lib/apihub/constants";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { toApiHubStagingBatchDetailDto } from "@/lib/apihub/staging-batch-dto";
import { getApiHubStagingBatchWithRows } from "@/lib/apihub/staging-batches-repo";

export const dynamic = "force-dynamic";

const ROW_LIMIT_DEFAULT = 100;

export async function GET(request: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;
  const { batchId } = await ctx.params;

  const url = new URL(request.url);
  const raw = url.searchParams.get("rowLimit");
  let rowLimit = ROW_LIMIT_DEFAULT;
  if (raw != null && raw.trim() !== "") {
    const n = Number(raw.trim());
    if (!Number.isFinite(n) || n < 1) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Staging batch detail query validation failed.", [
        { field: "rowLimit", code: "INVALID_NUMBER", message: "rowLimit must be a positive number when provided.", severity: "error" },
      ], requestId);
    }
    rowLimit = Math.min(Math.trunc(n), APIHUB_STAGING_BATCH_DETAIL_ROW_LIMIT_MAX);
  }

  const found = await getApiHubStagingBatchWithRows({
    tenantId: tenant.id,
    batchId,
    rowLimit,
  });
  if (!found) {
    return apiHubError(404, "NOT_FOUND", "Staging batch not found.", requestId);
  }

  return apiHubJson({ batch: toApiHubStagingBatchDetailDto(found.batch, found.rows) }, requestId);
}
