import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import {
  APIHUB_JSON_BODY_MAX_BYTES,
  APIHUB_STAGING_APPLY_TARGETS,
  type ApiHubStagingApplyTarget,
} from "@/lib/apihub/constants";
import { parseApiHubPostJsonForRoute } from "@/lib/apihub/request-body-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { applyApiHubStagingBatchToDownstream } from "@/lib/apihub/staging-batch-apply";
import { userHasGlobalGrant } from "@/lib/authz";

export const dynamic = "force-dynamic";

type PostBody = {
  target?: unknown;
  dryRun?: unknown;
};

function parseTarget(raw: unknown): ApiHubStagingApplyTarget | null {
  if (typeof raw !== "string") return null;
  return (APIHUB_STAGING_APPLY_TARGETS as readonly string[]).includes(raw) ? (raw as ApiHubStagingApplyTarget) : null;
}

export async function POST(request: Request, ctx: { params: Promise<{ batchId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;
  const { batchId } = await ctx.params;

  let body: PostBody = {};
  const parsedBody = await parseApiHubPostJsonForRoute(request, requestId, APIHUB_JSON_BODY_MAX_BYTES, {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PostBody;

  const target = parseTarget(body.target);
  if (!target) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Staging batch apply validation failed.", [
      {
        field: "target",
        code: "INVALID_ENUM",
        message: `target must be one of: ${APIHUB_STAGING_APPLY_TARGETS.join(", ")}.`,
        severity: "error",
      },
    ], requestId);
  }

  if (target === "sales_order" || target === "purchase_order") {
    if (!(await userHasGlobalGrant(actorId, "org.orders", "edit"))) {
      return apiHubError(
        403,
        "FORBIDDEN",
        "Applying to purchase or sales orders requires org.orders → edit.",
        requestId,
      );
    }
  }
  if (target === "control_tower_audit") {
    if (!(await userHasGlobalGrant(actorId, "org.controltower", "edit"))) {
      return apiHubError(
        403,
        "FORBIDDEN",
        "Applying to Control Tower audit requires org.controltower → edit.",
        requestId,
      );
    }
  }

  const dryRun = body.dryRun === true;

  const result = await applyApiHubStagingBatchToDownstream({
    tenantId: tenant.id,
    batchId,
    actorUserId: actorId,
    target,
    dryRun,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return apiHubError(404, "NOT_FOUND", result.message, requestId);
    }
    if (result.code === "CONFLICT") {
      return apiHubError(409, "CONFLICT", result.message, requestId);
    }
    return apiHubError(400, "STAGING_APPLY_FAILED", result.message, requestId);
  }

  return apiHubJson({ summary: result.summary }, requestId);
}
