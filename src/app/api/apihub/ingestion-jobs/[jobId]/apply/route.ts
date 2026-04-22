import { Prisma } from "@prisma/client";

import {
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import {
  APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY,
  apiHubIngestionRunAuditMetadataEnvelope,
} from "@/lib/apihub/audit-contract";
import { resolveApplyTargetSummary, resolveDryRunTargetSummary } from "@/lib/apihub/apply-target-summary";
import {
  APIHUB_INGESTION_APPLY_MATCH_KEYS,
  APIHUB_INGESTION_APPLY_WRITE_MODES,
  APIHUB_PURCHASE_ORDER_LINE_MERGE_MODES,
  APIHUB_STAGING_APPLY_TARGETS,
  apiHubIngestionUpsertAllowed,
  apiHubPurchaseOrderLineMergeAllowed,
  isApiHubIngestionApplyWriteMode,
  isApiHubPurchaseOrderLineMergeMode,
  type ApiHubIngestionApplyMatchKey,
  type ApiHubIngestionApplyWriteMode,
  type ApiHubPurchaseOrderLineMergeMode,
  type ApiHubStagingApplyTarget,
} from "@/lib/apihub/constants";
import { downstreamSummaryToTargetCounts } from "@/lib/apihub/downstream-mapped-rows-apply";
import { computeIngestionApplyIdempotencyFingerprint } from "@/lib/apihub/ingestion-apply-idempotency-fingerprint";
import { createApplyIdempotencyRecord, findApplyIdempotencyRecord } from "@/lib/apihub/ingestion-apply-idempotency-repo";
import {
  applyApiHubIngestionRun,
  type ApplyApiHubIngestionRunOutcome,
  type ApplyIngestionRunDownstreamOpts,
} from "@/lib/apihub/ingestion-apply-repo";
import { appendApiHubIngestionRunAuditLog } from "@/lib/apihub/ingestion-run-audit-repo";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { parseApiHubRequestJsonWithBudget } from "@/lib/apihub/request-budget";
import { logApiHubBackgroundError } from "@/lib/apihub/safe-server-log";
import { APIHUB_REQUEST_ID_HEADER, resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";
import { userHasGlobalGrant } from "@/lib/authz";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ApplyJsonBody = {
  dryRun?: unknown;
  idempotencyKey?: unknown;
  /** P3: same targets as staging batch apply — requires module grants. */
  target?: unknown;
  rows?: unknown;
  matchKey?: unknown;
  /** Ingestion only: `create_only` (default) or `upsert` (requires ref matchKey). */
  writeMode?: unknown;
  /** PO upsert only: `merge_by_line_no` (default) or `replace_all`. */
  purchaseOrderLineMerge?: unknown;
};

function parseApplyPostTarget(raw: unknown): ApiHubStagingApplyTarget | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  return (APIHUB_STAGING_APPLY_TARGETS as readonly string[]).includes(raw) ? (raw as ApiHubStagingApplyTarget) : null;
}

function parseApplyMatchKey(raw: unknown): ApiHubIngestionApplyMatchKey {
  if (raw === undefined || raw === null || typeof raw !== "string") {
    return "none";
  }
  return (APIHUB_INGESTION_APPLY_MATCH_KEYS as readonly string[]).includes(raw)
    ? (raw as ApiHubIngestionApplyMatchKey)
    : "none";
}

function parseApplyWriteMode(
  raw: unknown,
): { ok: true; mode: ApiHubIngestionApplyWriteMode } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, mode: "create_only" };
  }
  if (typeof raw === "string" && raw.trim() === "") {
    return { ok: true, mode: "create_only" };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "writeMode must be a string when provided." };
  }
  const t = raw.trim();
  if (!isApiHubIngestionApplyWriteMode(t)) {
    return {
      ok: false,
      message: `writeMode must be one of: ${APIHUB_INGESTION_APPLY_WRITE_MODES.join(", ")}.`,
    };
  }
  return { ok: true, mode: t };
}

function mergeOrderLineFieldProvided(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string" && raw.trim() === "") return false;
  return true;
}

function parsePurchaseOrderLineMerge(
  raw: unknown,
): { ok: true; mode: ApiHubPurchaseOrderLineMergeMode } | { ok: false; message: string } {
  if (!mergeOrderLineFieldProvided(raw)) {
    return { ok: true, mode: "merge_by_line_no" };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "purchaseOrderLineMerge must be a string when provided." };
  }
  const t = raw.trim();
  if (!isApiHubPurchaseOrderLineMergeMode(t)) {
    return {
      ok: false,
      message: `purchaseOrderLineMerge must be one of: ${APIHUB_PURCHASE_ORDER_LINE_MERGE_MODES.join(", ")}.`,
    };
  }
  return { ok: true, mode: t };
}

async function readApplyJsonBody(request: Request, requestId: string): Promise<ApplyJsonBody | Response> {
  const ct = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!ct.includes("application/json")) {
    return {};
  }
  const parsed = await parseApiHubRequestJsonWithBudget(request, "standard", { emptyOnInvalid: true });
  if (!parsed.ok) {
    return apiHubError(413, "PAYLOAD_TOO_LARGE", parsed.message, requestId);
  }
  const raw = parsed.value;
  return raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as ApplyJsonBody) : {};
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
  if (outcome.kind === "downstream_failed") {
    return {
      status: 409,
      body: {
        ok: false as const,
        error: { code: "APPLY_DOWNSTREAM_FAILED", message: outcome.message },
      },
    };
  }
  if (outcome.kind === "dry_run") {
    const targetSummary = outcome.downstreamPreview
      ? downstreamSummaryToTargetCounts(outcome.downstreamPreview)
      : resolveDryRunTargetSummary(outcome.wouldApply, outcome.run);
    const writeSummary = {
      wouldApply: outcome.wouldApply,
      wouldSetAppliedAt: outcome.wouldApply,
      targetSummary,
      ...(outcome.downstreamPreview ? { downstreamPreview: outcome.downstreamPreview } : {}),
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
  const targetSummary = outcome.downstreamSummary
    ? downstreamSummaryToTargetCounts(outcome.downstreamSummary)
    : resolveApplyTargetSummary(outcome.run);
  return {
    status: 200,
    body: {
      applied: true,
      targetSummary,
      ...(outcome.downstreamSummary ? { downstreamSummary: outcome.downstreamSummary } : {}),
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
  if (mapped.status === 200 && mapped.body.downstreamSummary != null) {
    x.downstreamSummary = mapped.body.downstreamSummary;
  }
  return x;
}

async function safeAppendIngestionRunAudit(
  opts: Parameters<typeof appendApiHubIngestionRunAuditLog>[0],
): Promise<void> {
  try {
    await appendApiHubIngestionRunAuditLog(opts);
  } catch (caught) {
    logApiHubBackgroundError("appendApiHubIngestionRunAuditLog failed", caught);
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
    ...apiHubIngestionRunAuditMetadataEnvelope(),
    requestId: opts.requestId,
    actorUserId: opts.actorUserId,
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
    action: APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY,
    metadata,
  });
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
  const jsonBodyOrErr = await readApplyJsonBody(request, requestId);
  if (jsonBodyOrErr instanceof Response) {
    return jsonBodyOrErr;
  }
  const jsonBody = jsonBodyOrErr;
  const dryRun = resolveApplyDryRun(request, jsonBody);
  const idempotencyKey = resolveApplyIdempotencyKey(request, jsonBody);
  const idempotencyKeyPresent = Boolean(idempotencyKey);

  let downstream: ApplyIngestionRunDownstreamOpts | undefined;
  if (jsonBody.target !== undefined && jsonBody.target !== null) {
    const target = parseApplyPostTarget(jsonBody.target);
    if (!target) {
      return finalizeApplyResponse({
        response: apiHubValidationError(400, "VALIDATION_ERROR", "Ingestion apply validation failed.", [
          {
            field: "target",
            code: "INVALID_ENUM",
            message: `target must be one of: ${APIHUB_STAGING_APPLY_TARGETS.join(", ")}.`,
            severity: "error",
          },
        ], requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        runId: jobId,
        requestId,
        dryRun,
        idempotencyKeyPresent,
        resultCode: "APPLY_VALIDATION_ERROR",
        outcome: null,
      });
    }
    if (target === "sales_order" || target === "purchase_order") {
      if (!(await userHasGlobalGrant(actorId, "org.orders", "edit"))) {
        return finalizeApplyResponse({
          response: apiHubError(
            403,
            "FORBIDDEN",
            "Applying to purchase or sales orders requires org.orders → edit.",
            requestId,
          ),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_FORBIDDEN_ORDERS",
          outcome: null,
        });
      }
    }
    if (target === "control_tower_audit") {
      if (!(await userHasGlobalGrant(actorId, "org.controltower", "edit"))) {
        return finalizeApplyResponse({
          response: apiHubError(
            403,
            "FORBIDDEN",
            "Applying to Control Tower audit requires org.controltower → edit.",
            requestId,
          ),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_FORBIDDEN_CONTROL_TOWER",
          outcome: null,
        });
      }
    }
    const matchKey = parseApplyMatchKey(jsonBody.matchKey);
    const writeParsed = parseApplyWriteMode(jsonBody.writeMode);
    if (!writeParsed.ok) {
      return finalizeApplyResponse({
        response: apiHubValidationError(400, "VALIDATION_ERROR", "Ingestion apply validation failed.", [
          { field: "writeMode", code: "INVALID_ENUM", message: writeParsed.message, severity: "error" },
        ], requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        runId: jobId,
        requestId,
        dryRun,
        idempotencyKeyPresent,
        resultCode: "APPLY_VALIDATION_ERROR",
        outcome: null,
      });
    }
    if (writeParsed.mode === "upsert" && !apiHubIngestionUpsertAllowed(target, matchKey)) {
      return finalizeApplyResponse({
        response: apiHubValidationError(400, "VALIDATION_ERROR", "Ingestion apply validation failed.", [
          {
            field: "writeMode",
            code: "INVALID_COMBINATION",
            message:
              "upsert requires target sales_order with matchKey sales_order_external_ref, or target purchase_order with matchKey purchase_order_buyer_reference.",
            severity: "error",
          },
        ], requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        runId: jobId,
        requestId,
        dryRun,
        idempotencyKeyPresent,
        resultCode: "APPLY_VALIDATION_ERROR",
        outcome: null,
      });
    }
    const poLineMergeAllowed = apiHubPurchaseOrderLineMergeAllowed(target, matchKey, writeParsed.mode);
    if (!poLineMergeAllowed && mergeOrderLineFieldProvided(jsonBody.purchaseOrderLineMerge)) {
      return finalizeApplyResponse({
        response: apiHubValidationError(400, "VALIDATION_ERROR", "Ingestion apply validation failed.", [
          {
            field: "purchaseOrderLineMerge",
            code: "INVALID_COMBINATION",
            message:
              "purchaseOrderLineMerge is only allowed for target purchase_order with matchKey purchase_order_buyer_reference and writeMode upsert.",
            severity: "error",
          },
        ], requestId),
        tenantId: tenant.id,
        actorUserId: actorId,
        runId: jobId,
        requestId,
        dryRun,
        idempotencyKeyPresent,
        resultCode: "APPLY_VALIDATION_ERROR",
        outcome: null,
      });
    }
    let purchaseOrderLineMerge: ApiHubPurchaseOrderLineMergeMode | undefined;
    if (poLineMergeAllowed) {
      const mergeParsed = parsePurchaseOrderLineMerge(jsonBody.purchaseOrderLineMerge);
      if (!mergeParsed.ok) {
        return finalizeApplyResponse({
          response: apiHubValidationError(400, "VALIDATION_ERROR", "Ingestion apply validation failed.", [
            {
              field: "purchaseOrderLineMerge",
              code: "INVALID_ENUM",
              message: mergeParsed.message,
              severity: "error",
            },
          ], requestId),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_VALIDATION_ERROR",
          outcome: null,
        });
      }
      purchaseOrderLineMerge = mergeParsed.mode;
    }
    downstream = {
      target,
      actorUserId: actorId,
      bodyRows: jsonBody.rows,
      matchKey,
      writeMode: writeParsed.mode,
      ...(purchaseOrderLineMerge != null ? { purchaseOrderLineMerge } : {}),
    };
  } else if (jsonBody.rows !== undefined) {
    return finalizeApplyResponse({
      response: apiHubValidationError(400, "VALIDATION_ERROR", "Ingestion apply validation failed.", [
        {
          field: "rows",
          code: "REQUIRES_TARGET",
          message: "rows requires target (sales_order, purchase_order, or control_tower_audit).",
          severity: "error",
        },
      ], requestId),
      tenantId: tenant.id,
      actorUserId: actorId,
      runId: jobId,
      requestId,
      dryRun,
      idempotencyKeyPresent,
      resultCode: "APPLY_VALIDATION_ERROR",
      outcome: null,
    });
  }

  const writeModeForFingerprint = downstream?.writeMode ?? "create_only";
  const purchaseOrderLineMergeForFingerprint =
    downstream &&
    apiHubPurchaseOrderLineMergeAllowed(downstream.target, downstream.matchKey, writeModeForFingerprint)
      ? (downstream.purchaseOrderLineMerge ?? "merge_by_line_no")
      : undefined;

  const requestFingerprint = computeIngestionApplyIdempotencyFingerprint({
    downstream: downstream
      ? {
          target: downstream.target,
          matchKey: downstream.matchKey,
          writeMode: writeModeForFingerprint,
          ...(purchaseOrderLineMergeForFingerprint != null
            ? { purchaseOrderLineMerge: purchaseOrderLineMergeForFingerprint }
            : {}),
          bodyRows: downstream.bodyRows,
        }
      : undefined,
  });

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
      if (cached.requestFingerprint !== requestFingerprint) {
        return finalizeApplyResponse({
          response: apiHubError(
            409,
            "APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH",
            "This idempotency key is already stored for a different apply payload (marker vs downstream, target, rows source, matchKey, or writeMode). Use a new idempotency key when changing the apply shape.",
            requestId,
          ),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH",
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

  const outcome = await applyApiHubIngestionRun({ tenantId: tenant.id, runId: jobId, dryRun, downstream });
  const mapped = mapApplyOutcomeToMapped(outcome);

  if (idempotencyKey) {
    const persisted = await createApplyIdempotencyRecord({
      tenantId: tenant.id,
      idempotencyKey,
      runId: jobId,
      dryRun,
      requestFingerprint,
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
      if (ex.requestFingerprint !== requestFingerprint) {
        return finalizeApplyResponse({
          response: apiHubError(
            409,
            "APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH",
            "This idempotency key is already stored for a different apply payload (marker vs downstream, target, rows source, matchKey, or writeMode). Use a new idempotency key when changing the apply shape.",
            requestId,
          ),
          tenantId: tenant.id,
          actorUserId: actorId,
          runId: jobId,
          requestId,
          dryRun,
          idempotencyKeyPresent,
          resultCode: "APPLY_IDEMPOTENCY_PAYLOAD_MISMATCH",
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
