import { apiHubError, apiHubJson } from "@/lib/apihub/api-error";
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
    return apiHubJson(
      { error: "Demo tenant not found. Run `npm run db:seed` to create starter data." },
      requestId,
      404,
    );
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubJson(
      {
        error:
          "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
      },
      requestId,
      403,
    );
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
      return apiHubJson({ error: "Run not found." }, requestId, 404);
    }
    return apiHubJson({ run: toApiHubIngestionRunDto(retried) }, requestId, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "retry_requires_failed_status") {
      return apiHubError(409, "RETRY_REQUIRES_FAILED", "Only failed runs can be retried.", requestId);
    }
    if (error instanceof Error && error.message === "retry_limit_reached") {
      return apiHubError(409, "RETRY_LIMIT_REACHED", "Run has reached its max retry attempts.", requestId);
    }
    throw error;
  }
}
