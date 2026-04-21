import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { applyApiHubIngestionRun } from "@/lib/apihub/ingestion-apply-repo";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

async function resolveApplyDryRun(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const q = url.searchParams.get("dryRun")?.trim().toLowerCase();
  if (q === "1" || q === "true" || q === "yes") {
    return true;
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return false;
  }
  try {
    const body = (await request.clone().json()) as { dryRun?: unknown };
    return body.dryRun === true;
  } catch {
    return false;
  }
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
  const dryRun = await resolveApplyDryRun(request);
  const outcome = await applyApiHubIngestionRun({ tenantId: tenant.id, runId: jobId, dryRun });
  if (!outcome) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }

  if (outcome.kind === "dry_run") {
    const writeSummary = {
      wouldApply: outcome.wouldApply,
      wouldSetAppliedAt: outcome.wouldApply,
      ...(outcome.gate ? { gate: outcome.gate } : {}),
    };
    return apiHubJson(
      {
        dryRun: true,
        writeSummary,
        run: toApiHubIngestionRunDto(outcome.run),
      },
      requestId,
      200,
    );
  }

  if (outcome.kind === "not_succeeded") {
    return apiHubError(
      409,
      "APPLY_RUN_NOT_SUCCEEDED",
      `Apply requires a succeeded ingestion run (current status: ${outcome.status}).`,
      requestId,
    );
  }
  if (outcome.kind === "already_applied") {
    return apiHubError(
      409,
      "APPLY_ALREADY_APPLIED",
      "This ingestion run was already marked as applied.",
      requestId,
    );
  }
  if (outcome.kind === "blocked") {
    if (outcome.reason === "connector_not_found") {
      return apiHubError(
        409,
        "APPLY_BLOCKED_CONNECTOR_NOT_FOUND",
        "Apply is blocked because the linked connector no longer exists.",
        requestId,
      );
    }
    return apiHubError(
      409,
      "APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE",
      `Apply is blocked because the linked connector is not active (status: ${outcome.connectorStatus ?? "unknown"}).`,
      requestId,
    );
  }

  return apiHubJson(
    { applied: true, run: toApiHubIngestionRunDto(outcome.run) },
    requestId,
    200,
  );
}
