import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { APIHUB_INGESTION_JOB_STATUSES, APIHUB_JSON_BODY_MAX_BYTES } from "@/lib/apihub/constants";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { getApiHubIngestionRunById, transitionApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { buildApiHubRunObservability } from "@/lib/apihub/run-observability";
import { parseApiHubPostJsonForRoute } from "@/lib/apihub/request-body-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { ApiHubRunStatus, canTransitionRunStatus, isValidRunStatus } from "@/lib/apihub/run-lifecycle";

export const dynamic = "force-dynamic";

type PatchBody = {
  status?: unknown;
  resultSummary?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
};

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;
  const { jobId } = await context.params;
  const run = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!run) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }
  // Retry chain context (bounded walk: maxAttempts is small).
  let retryDepth = 0;
  let rootRunId = run.id;
  let cursor = run.retryOfRunId;
  while (cursor && retryDepth < 25) {
    const parent = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: cursor });
    if (!parent) {
      break;
    }
    retryDepth += 1;
    rootRunId = parent.id;
    cursor = parent.retryOfRunId;
  }

  const observability = buildApiHubRunObservability({
    row: {
      id: run.id,
      attempt: run.attempt,
      maxAttempts: run.maxAttempts,
      enqueuedAt: run.enqueuedAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    },
    retryDepth,
    rootRunId,
    now: new Date(),
  });

  return apiHubJson({ run: toApiHubIngestionRunDto(run), observability }, requestId);
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  const { jobId } = await context.params;
  let body: PatchBody = {};
  const parsedBody = await parseApiHubPostJsonForRoute(request, requestId, APIHUB_JSON_BODY_MAX_BYTES, {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PatchBody;

  const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!isValidRunStatus(rawStatus)) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Run payload validation failed.", [
      {
        field: "status",
        code: "INVALID_ENUM",
        message: `status must be one of: ${APIHUB_INGESTION_JOB_STATUSES.join(", ")}.`,
        severity: "error",
      },
    ], requestId);
  }

  const existing = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!existing) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }
  if (!isValidRunStatus(existing.status)) {
    return apiHubError(409, "RUN_STATE_INVALID", "Run has invalid persisted status.", requestId);
  }
  if (!canTransitionRunStatus(existing.status as ApiHubRunStatus, rawStatus)) {
    return apiHubError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Invalid status transition: ${existing.status} -> ${rawStatus}.`,
      requestId,
    );
  }

  const resultSummary =
    typeof body.resultSummary === "string" && body.resultSummary.trim().length > 0
      ? body.resultSummary.trim().slice(0, 500)
      : null;
  const errorCode =
    typeof body.errorCode === "string" && body.errorCode.trim().length > 0
      ? body.errorCode.trim().slice(0, 120)
      : null;
  const errorMessage =
    typeof body.errorMessage === "string" && body.errorMessage.trim().length > 0
      ? body.errorMessage.trim().slice(0, 500)
      : null;

  try {
    const updated = await transitionApiHubIngestionRun({
      tenantId: tenant.id,
      runId: jobId,
      nextStatus: rawStatus,
      resultSummary,
      errorCode,
      errorMessage,
    });
    if (!updated) {
      return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
    }
    return apiHubJson({ run: toApiHubIngestionRunDto(updated) }, requestId);
  } catch (error) {
    if (error instanceof Error && error.message === "run_transition_stale") {
      return apiHubError(
        409,
        "RUN_TRANSITION_STALE",
        "Run status changed before this update applied; fetch the latest run and retry if appropriate.",
        requestId,
      );
    }
    if (error instanceof Error && error.message === "run_invalid_transition_target") {
      return apiHubError(409, "INVALID_STATUS_TRANSITION", "That status is not a valid transition target.", requestId);
    }
    if (error instanceof Error && error.message === "run_transition_missing_row") {
      return apiHubError(500, "RUN_TRANSITION_INTERNAL", "Run row missing after status update.", requestId);
    }
    throw error;
  }
}
