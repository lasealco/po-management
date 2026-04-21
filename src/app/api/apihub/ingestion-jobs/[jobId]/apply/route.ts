import { Prisma } from "@prisma/client";

import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { resolveApplyTargetSummary, resolveDryRunTargetSummary } from "@/lib/apihub/apply-target-summary";
import { createApplyIdempotencyRecord, findApplyIdempotencyRecord } from "@/lib/apihub/ingestion-apply-idempotency-repo";
import { applyApiHubIngestionRun, type ApplyApiHubIngestionRunOutcome } from "@/lib/apihub/ingestion-apply-repo";
import { appendApiHubIngestionRunAuditLog } from "@/lib/apihub/ingestion-run-audit-repo";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { APIHUB_REQUEST_ID_HEADER, resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ApplyJsonBody = { dryRun?: unknown; idempotencyKey?: unknown };

async function readApplyJsonBody(request: Request): Promise<ApplyJsonBody> {
  const ct = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!ct.includes("application/json")) {
    return {};
  }
  try {
    const raw = (await request.json()) as ApplyJsonBody;
    return raw != null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function resolveApplyDryRun(request: Request, body: ApplyJsonBody): boolean {
  const url = new URL(request.url);
  const q = url.searchParams.get("dryRun")?.trim().toLowerCase();
  if (q === "1" || q === "true" || q === "yes") {
    return true;
  }
  return body.dryRun === true;
}

function resolveApplyIdempotencyKey(request: Request, body: ApplyJsonBody): string | null {
  const rawBody =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const rawHeader = request.headers.get("idempotency-key")?.trim() ?? null;
  const picked = rawHeader || rawBody;
  return picked ? picked.slice(0, 128) : null;
}

type ApplyMappedResponse = { status: number; body: Record<string, unknown> };

function mapApplyOutcomeToMapped(outcome: ApplyApiHubIngestionRunOutcome | null): ApplyMappedResponse {
  if (!outcome) {
    return {
      status: 404,
      body: { ok: false as const, error: { code: "RUN_NOT_FOUND", message: "Run not found." } },
    };
  }
  if (outcome.kind === "dry_run") {
    const writeSummary = {
      wouldApply: outcome.wouldApply,
      wouldSetAppliedAt: outcome.wouldApply,
      targetSummary: resolveDryRunTargetSummary(outcome.wouldApply, outcome.run),
      ...(outcome.gate ? { gate: outcome.gate } : {}),
    };
    return {
      status: 200,
      body: {
        dryRun: true,
        writeSummary,
        run: toApiHubIngestionRunDto(outcome.run),
      },
    };
  }
  if (outcome.kind === "not_succeeded") {
    return {
      status: 409,
      body: {
        ok: false as const,
        error: {
          code: "APPLY_RUN_NOT_SUCCEEDED",
          message: `Apply requires a succeeded ingestion run (current status: ${outcome.status}).`,
        },
      },
    };
  }
  if (outcome.kind === "already_applied") {
    return {
      status: 409,
      body: {
        ok: false as const,
        error: {
          code: "APPLY_ALREADY_APPLIED",
          message: "This ingestion run was already marked as applied.",
        },
      },
    };
  }
  if (outcome.kind === "blocked") {
    if (outcome.reason === "connector_not_found") {
      return {
        status: 409,
        body: {
          ok: false as const,
          error: {
            code: "APPLY_BLOCKED_CONNECTOR_NOT_FOUND",
            message: "Apply is blocked because the linked connector no longer exists.",
          },
        },
      };
    }
    return {
      status: 409,
      body: {
        ok: false as const,
        error: {
          code: "APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE",
          message: `Apply is blocked because the linked connector is not active (status: ${outcome.connectorStatus ?? "unknown"}).`,
        },
      },
    };
  }
  return {
    status: 200,
    body: {
      applied: true,
      targetSummary: resolveApplyTargetSummary(outcome.run),
      run: toApiHubIngestionRunDto(outcome.run),
    },
  };
}

function respondMapped(mapped: ApplyMappedResponse, requestId: string): NextResponse {
  if (mapped.status === 200) {
    return apiHubJson(mapped.body, requestId, 200);
  }
  const err = mapped.body.error as { code: string; message: string };
  return apiHubError(mapped.status, err.code, err.message, requestId);
}

function idempotentReplayResponse(
  record: { responseStatus: number; responseBody: unknown },
  requestId: string,
): NextResponse {
  const base =
    record.responseBody != null && typeof record.responseBody === "object" && !Array.isArray(record.responseBody)
      ? (record.responseBody as Record<string, unknown>)
      : {};
  return NextResponse.json(
    { ...base, idempotentReplay: true },
    { status: record.responseStatus, headers: { [APIHUB_REQUEST_ID_HEADER]: requestId } },
  );
}

function auditOutcomeFromStatus(httpStatus: number): "success" | "client_error" | "not_found" {
  if (httpStatus === 404) {
    return "not_found";
  }
  if (httpStatus >= 400) {
    return "client_error";
  }
  return "success";
}

function inferApplyResultCode(mapped: ApplyMappedResponse): string {
  if (mapped.status === 404) {
    return "RUN_NOT_FOUND";
  }
  const err = mapped.body.error as { code?: string } | undefined;
  if (mapped.status === 409 && err?.code) {
    return err.code;
  }
  if (mapped.status === 200 && mapped.body.dryRun === true) {
    return "APPLY_DRY_RUN";
  }
  if (mapped.status === 200 && mapped.body.applied === true) {
    return "APPLY_COMMITTED";
  }
  return "APPLY_UNKNOWN";
}

function runProbeFromOutcome(outcome: ApplyApiHubIngestionRunOutcome | null): Record<string, unknown> | undefined {
  if (!outcome || !("run" in outcome)) {
    return undefined;
  }
  return {
    runStatusAtDecision: outcome.run.status,
    connectorId: outcome.run.connectorId,
    attempt: outcome.run.attempt,
    maxAttempts: outcome.run.maxAttempts,
  };
}

function extrasFromMapped(mapped: ApplyMappedResponse): Record<string, unknown> {
  const x: Record<string, unknown> = {};
  if (mapped.status === 200 && mapped.body.targetSummary != null) {
    x.targetSummary = mapped.body.targetSummary;
  }
  if (mapped.status === 200 && mapped.body.writeSummary != null) {
    x.writeSummary = mapped.body.writeSummary;
  }
  return x;
}

async function safeAppendIngestionRunAudit(
  opts: Parameters<typeof appendApiHubIngestionRunAuditLog>[0],
): Promise<void> {
  try {
    await appendApiHubIngestionRunAuditLog(opts);
  } catch (caught) {
    console.error("[apihub] appendApiHubIngestionRunAuditLog failed", caught);
  }
}

async function finalizeApplyResponse(opts: {
  response: NextResponse;
  tenantId: string;
  actorUserId: string;
  runId: string;
  requestId: string;
  dryRun: boolean;
  idempotencyKeyPresent: boolean;
  resultCode: string;
  idempotentReplay?: boolean;
  outcome: ApplyApiHubIngestionRunOutcome | null;
  mapped?: ApplyMappedResponse;
}): Promise<NextResponse> {
  const httpStatus = opts.response.status;
  const metadata = {
    requestId: opts.requestId,
    verb: "apply" as const,
    resultCode: opts.resultCode,
    httpStatus,
    outcome: auditOutcomeFromStatus(httpStatus),
    dryRun: opts.dryRun,
    idempotencyKeyPresent: opts.idempotencyKeyPresent,
    idempotentReplay: opts.idempotentReplay ?? false,
    ...(runProbeFromOutcome(opts.outcome) ?? {}),
    ...(opts.mapped ? extrasFromMapped(opts.mapped) : {}),
  };
  await safeAppendIngestionRunAudit({
    tenantId: opts.tenantId,
    actorUserId: opts.actorUserId,
    ingestionRunId: opts.runId,
    action: "apply",
    metadata,
  });
  return opts.response;
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
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
  const jsonBody = await readApplyJsonBody(request);
  const dryRun = resolveApplyDryRun(request, jsonBody);
  const idempotencyKey = resolveApplyIdempotencyKey(request, jsonBody);
  const idempotencyKeyPresent = Boolean(idempotencyKey);

  if (idempotencyKey) {
    const cached = await findApplyIdempotencyRecord({ tenantId: tenant.id, idempotencyKey });
    if (cached) {
      if (cached.ingestionRunId !== jobId || cached.dryRun !== dryRun) {
        return finalizeApplyResponse({
          response: apiHubError(
            409,
            "APPLY_IDEMPOTENCY_KEY_CONFLICT",
            "This idempotency key is already used for a different ingestion apply.",
            requestId,
          ),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_IDEMPOTENCY_KEY_CONFLICT",
          outcome: null,
        });
      }
      return finalizeApplyResponse({
        response: idempotentReplayResponse(cached, requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        runId: jobId,
        requestId,
        dryRun,
        idempotencyKeyPresent,
        resultCode: "APPLY_IDEMPOTENT_REPLAY",
        idempotentReplay: true,
        outcome: null,
      });
    }
  }

  const outcome = await applyApiHubIngestionRun({ tenantId: tenant.id, runId: jobId, dryRun });
  const mapped = mapApplyOutcomeToMapped(outcome);

  if (idempotencyKey) {
    const persisted = await createApplyIdempotencyRecord({
      tenantId: tenant.id,
      idempotencyKey,
      runId: jobId,
      dryRun,
      responseStatus: mapped.status,
      responseBody: mapped.body as Prisma.InputJsonValue,
    });
    if (!persisted.created) {
      const ex = persisted.existing;
      if (ex.ingestionRunId !== jobId || ex.dryRun !== dryRun) {
        return finalizeApplyResponse({
          response: apiHubError(
            409,
            "APPLY_IDEMPOTENCY_KEY_CONFLICT",
            "This idempotency key is already used for a different ingestion apply.",
            requestId,
          ),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_IDEMPOTENCY_KEY_CONFLICT",
          outcome: null,
        });
      }
      return finalizeApplyResponse({
        response: idempotentReplayResponse(ex, requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        runId: jobId,
        requestId,
        dryRun,
        idempotencyKeyPresent,
        resultCode: "APPLY_IDEMPOTENT_REPLAY",
        idempotentReplay: true,
        outcome: null,
      });
    }
  }

  return finalizeApplyResponse({
    response: respondMapped(mapped, requestId),
    tenantId: tenant.id,
    actorUserId: actorId,
    runId: jobId,
    requestId,
    dryRun,
    idempotencyKeyPresent,
    resultCode: inferApplyResultCode(mapped),
    outcome,
    mapped,
  });
}
