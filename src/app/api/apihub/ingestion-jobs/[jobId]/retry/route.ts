import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { retryApiHubIngestionRun } from "@/lib/apihub/ingestion-runs-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  idempotencyKey?: unknown;
};

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
  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const rawBodyIdempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const rawHeaderIdempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
  const idempotencyKey = (rawHeaderIdempotencyKey || rawBodyIdempotencyKey)?.slice(0, 128) ?? null;

  try {
    const retried = await retryApiHubIngestionRun({
      tenantId: tenant.id,
      actorUserId: actorId,
      runId: jobId,
      idempotencyKey,
    });
    if (!retried) {
      return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
    }
    return apiHubJson(
      { run: toApiHubIngestionRunDto(retried.run), idempotentReplay: retried.idempotentReplay },
      requestId,
      retried.idempotentReplay ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "retry_requires_failed_status") {
      return apiHubError(409, "RETRY_REQUIRES_FAILED", "Only failed runs can be retried.", requestId);
    }
    if (error instanceof Error && error.message === "retry_limit_reached") {
      return apiHubError(
        409,
        "RETRY_LIMIT_REACHED",
        "Run has reached the max retry attempts allowed for this job (maxAttempts budget from job creation).",
        requestId,
      );
    }
    if (error instanceof Error && error.message === "retry_idempotency_key_conflict") {
      return apiHubError(
        409,
        "RETRY_IDEMPOTENCY_KEY_CONFLICT",
        "This idempotency key is already used for a different ingestion run.",
        requestId,
      );
    }
    throw error;
  }
}
