import {
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import {
  APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY,
  apiHubIngestionRunAuditMetadataEnvelope,
} from "@/lib/apihub/audit-contract";
import { appendApiHubIngestionRunAuditLog } from "@/lib/apihub/ingestion-run-audit-repo";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { retryApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { parseApiHubPostJsonForRouteWithBudget } from "@/lib/apihub/request-budget";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PostBody = {
  idempotencyKey?: unknown;
};

type RetryRunRow = {
  id: string;
  status?: string;
  connectorId?: string | null;
  attempt?: number;
  maxAttempts?: number;
};

function auditOutcomeFromStatus(httpStatus: number): "success" | "client_error" | "not_found" {
  if (httpStatus === 404) {
    return "not_found";
  }
  if (httpStatus >= 400) {
    return "client_error";
  }
  return "success";
}

async function finalizeRetryResponse(opts: {
  response: NextResponse;
  tenantId: string;
  actorUserId: string;
  sourceRunId: string;
  requestId: string;
  idempotencyKeyPresent: boolean;
  resultCode: string;
  idempotentReplay?: boolean;
  retriedRun?: RetryRunRow | null;
}): Promise<NextResponse> {
  const httpStatus = opts.response.status;
  const metadata = {
    ...apiHubIngestionRunAuditMetadataEnvelope(),
    requestId: opts.requestId,
    actorUserId: opts.actorUserId,
    verb: "retry" as const,
    resultCode: opts.resultCode,
    httpStatus,
    outcome: auditOutcomeFromStatus(httpStatus),
    idempotencyKeyPresent: opts.idempotencyKeyPresent,
    idempotentReplay: opts.idempotentReplay ?? false,
    sourceRunId: opts.sourceRunId,
    retriedRunId: opts.retriedRun?.id,
    retriedRunStatus: opts.retriedRun?.status,
    connectorId: opts.retriedRun?.connectorId ?? null,
    attempt: opts.retriedRun?.attempt,
    maxAttempts: opts.retriedRun?.maxAttempts,
  };
  try {
    await appendApiHubIngestionRunAuditLog({
      tenantId: opts.tenantId,
      actorUserId: opts.actorUserId,
      ingestionRunId: opts.sourceRunId,
      action: APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY,
      metadata,
    });
  } catch (caught) {
    console.error("[apihub] appendApiHubIngestionRunAuditLog failed", caught);
  }
  return opts.response;
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "edit");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant, actorId } = gate.ctx;

  const { jobId } = await context.params;
  let body: PostBody = {};
  const parsedBody = await parseApiHubPostJsonForRouteWithBudget(request, requestId, "standard", {
    emptyOnInvalid: true,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  body = parsedBody.value as PostBody;

  const rawBodyIdempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const rawHeaderIdempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
  const idempotencyKey = (rawHeaderIdempotencyKey || rawBodyIdempotencyKey)?.slice(0, 128) ?? null;
  const idempotencyKeyPresent = Boolean(idempotencyKey);

  try {
    const retried = await retryApiHubIngestionRun({
      tenantId: tenant.id,
      actorUserId: actorId,
      runId: jobId,
      idempotencyKey,
    });
    if (!retried) {
      return finalizeRetryResponse({
        response: apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        sourceRunId: jobId,
        requestId,
        idempotencyKeyPresent,
        resultCode: "RUN_NOT_FOUND",
        retriedRun: null,
      });
    }
    const runRow = retried.run as RetryRunRow;
    return finalizeRetryResponse({
      response: apiHubJson(
        { run: toApiHubIngestionRunDto(retried.run), idempotentReplay: retried.idempotentReplay },
        requestId,
        retried.idempotentReplay ? 200 : 201,
      ),
      tenantId: tenant.id,
      actorUserId: actorId,
      sourceRunId: jobId,
      requestId,
      idempotencyKeyPresent,
      resultCode: retried.idempotentReplay ? "RETRY_IDEMPOTENT_REPLAY" : "RETRY_CREATED",
      idempotentReplay: retried.idempotentReplay,
      retriedRun: runRow,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "retry_requires_failed_status") {
      return finalizeRetryResponse({
        response: apiHubError(409, "RETRY_REQUIRES_FAILED", "Only failed runs can be retried.", requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        sourceRunId: jobId,
        requestId,
        idempotencyKeyPresent,
        resultCode: "RETRY_REQUIRES_FAILED",
        retriedRun: null,
      });
    }
    if (error instanceof Error && error.message === "retry_limit_reached") {
      return finalizeRetryResponse({
        response: apiHubError(
          409,
          "RETRY_LIMIT_REACHED",
          "Run has reached the max retry attempts allowed for this job (maxAttempts budget from job creation).",
          requestId,
        ),
        tenantId: tenant.id,
        actorUserId: actorId,
        sourceRunId: jobId,
        requestId,
        idempotencyKeyPresent,
        resultCode: "RETRY_LIMIT_REACHED",
        retriedRun: null,
      });
    }
    if (error instanceof Error && error.message === "retry_idempotency_key_conflict") {
      return finalizeRetryResponse({
        response: apiHubError(
          409,
          "RETRY_IDEMPOTENCY_KEY_CONFLICT",
          "This idempotency key is already used for a different ingestion run.",
          requestId,
        ),
        tenantId: tenant.id,
        actorUserId: actorId,
        sourceRunId: jobId,
        requestId,
        idempotencyKeyPresent,
        resultCode: "RETRY_IDEMPOTENCY_KEY_CONFLICT",
        retriedRun: null,
      });
    }
    throw error;
  }
}
