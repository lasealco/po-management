import {
  apiHubError,
  apiHubJson,
  apiHubStagingBatchCreateFailedMessage,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { toApiHubStagingBatchListItemDto } from "@/lib/apihub/staging-batch-dto";
import {
  createApiHubStagingBatchFromAnalysisJob,
  listApiHubStagingBatches,
} from "@/lib/apihub/staging-batches-repo";

export const dynamic = "force-dynamic";

type PostBody = {
  mappingAnalysisJobId?: unknown;
  title?: unknown;
};

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const limitParsed = parseApiHubListLimitFromUrl(new URL(request.url));
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Staging batch list query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
        severity: "error",
      },
    ], requestId);
  }

  const rows = await listApiHubStagingBatches({ tenantId: tenant.id, limit: limitParsed.limit });
  return apiHubJson({ batches: rows.map(toApiHubStagingBatchListItemDto) }, requestId);
}

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  let body: PostBody = {};
  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "standard", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PostBody;

  const jobId = typeof body.mappingAnalysisJobId === "string" ? body.mappingAnalysisJobId.trim() : "";
  if (!jobId) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Staging batch create validation failed.", [
      { field: "mappingAnalysisJobId", code: "REQUIRED", message: "mappingAnalysisJobId is required.", severity: "error" },
    ], requestId);
  }

  let title: string | null = null;
  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== "string") {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Staging batch create validation failed.", [
        { field: "title", code: "INVALID_TYPE", message: "title must be a string when provided.", severity: "error" },
      ], requestId);
    }
    const t = body.title.trim();
    title = t.length > 0 ? t.slice(0, 200) : null;
  }

  try {
    const batch = await createApiHubStagingBatchFromAnalysisJob({
      tenantId: tenant.id,
      actorUserId: actorId,
      mappingAnalysisJobId: jobId,
      title,
    });
    return apiHubJson({ batch: toApiHubStagingBatchListItemDto(batch) }, requestId, 201);
  } catch (e) {
    const msg = apiHubStagingBatchCreateFailedMessage(e, "Could not create staging batch.");
    return apiHubError(400, "STAGING_BATCH_CREATE_FAILED", msg, requestId);
  }
}
