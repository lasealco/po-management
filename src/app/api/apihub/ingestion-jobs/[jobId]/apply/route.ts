import { Prisma } from "@prisma/client";

import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { createApplyIdempotencyRecord, findApplyIdempotencyRecord } from "@/lib/apihub/ingestion-apply-idempotency-repo";
import { applyApiHubIngestionRun, type ApplyApiHubIngestionRunOutcome } from "@/lib/apihub/ingestion-apply-repo";
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

  if (idempotencyKey) {
    const cached = await findApplyIdempotencyRecord({ tenantId: tenant.id, idempotencyKey });
    if (cached) {
      if (cached.ingestionRunId !== jobId || cached.dryRun !== dryRun) {
        return apiHubError(
          409,
          "APPLY_IDEMPOTENCY_KEY_CONFLICT",
          "This idempotency key is already used for a different ingestion apply.",
          requestId,
        );
      }
      return idempotentReplayResponse(cached, requestId);
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
        return apiHubError(
          409,
          "APPLY_IDEMPOTENCY_KEY_CONFLICT",
          "This idempotency key is already used for a different ingestion apply.",
          requestId,
        );
      }
      return idempotentReplayResponse(ex, requestId);
    }
  }

  return respondMapped(mapped, requestId);
}
