import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { APIHUB_INGESTION_JOB_STATUSES } from "@/lib/apihub/constants";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { getApiHubIngestionRunById, transitionApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { buildApiHubRunObservability } from "@/lib/apihub/run-observability";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { ApiHubRunStatus, canTransitionRunStatus, isValidRunStatus } from "@/lib/apihub/run-lifecycle";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PatchBody = {
  status?: unknown;
  resultSummary?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
};

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }
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
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
  }

  const { jobId } = await context.params;
  let body: PatchBody = {};
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    body = {};
  }

  const rawStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!isValidRunStatus(rawStatus)) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Run payload validation failed.", [
      {
        field: "status",
        code: "INVALID_ENUM",
        message: `status must be one of: ${APIHUB_INGESTION_JOB_STATUSES.join(", ")}.`,
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
}
