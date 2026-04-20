import { NextResponse } from "next/server";

import { getActorUserId } from "@/lib/authz";
import { APIHUB_INGESTION_JOB_STATUSES } from "@/lib/apihub/constants";
import { apiHubError, apiHubValidationError } from "@/lib/apihub/api-error";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { getApiHubIngestionRunById, transitionApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { ApiHubRunStatus, canTransitionRunStatus, isValidRunStatus } from "@/lib/apihub/run-lifecycle";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PatchBody = {
  status?: unknown;
  resultSummary?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
};

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "Demo tenant not found. Run `npm run db:seed` to create starter data." },
      { status: 404 },
    );
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
  }
  const { jobId } = await context.params;
  const run = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json({ run: toApiHubIngestionRunDto(run) });
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "Demo tenant not found. Run `npm run db:seed` to create starter data." },
      { status: 404 },
    );
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json(
      {
        error:
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      { status: 403 },
    );
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
    ]);
  }

  const existing = await getApiHubIngestionRunById({ tenantId: tenant.id, runId: jobId });
  if (!existing) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  if (!isValidRunStatus(existing.status)) {
    return NextResponse.json({ error: "Run has invalid persisted status." }, { status: 409 });
  }
  if (!canTransitionRunStatus(existing.status as ApiHubRunStatus, rawStatus)) {
    return apiHubError(409, "INVALID_STATUS_TRANSITION", `Invalid status transition: ${existing.status} -> ${rawStatus}.`);
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
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json({ run: toApiHubIngestionRunDto(updated) });
}
