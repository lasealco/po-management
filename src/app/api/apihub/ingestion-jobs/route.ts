import { apiHubJson, apiHubValidationError } from "@/lib/apihub/api-error";
import { APIHUB_INGESTION_JOB_STATUSES } from "@/lib/apihub/constants";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { createApiHubIngestionRun, listApiHubIngestionRuns } from "@/lib/apihub/ingestion-runs-repo";
import { parseApiHubListLimitFromUrl } from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { isValidRunStatus } from "@/lib/apihub/run-lifecycle";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

type PostBody = {
  connectorId?: unknown;
  idempotencyKey?: unknown;
};

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const rawStatus = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  if (rawStatus.length > 0 && !isValidRunStatus(rawStatus)) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Run query validation failed.", [
      {
        field: "status",
        code: "INVALID_ENUM",
        message: `status must be one of: ${APIHUB_INGESTION_JOB_STATUSES.join(", ")}.`,
      },
    ], requestId);
  }

  const limit = parseApiHubListLimitFromUrl(url);
  const rows = await listApiHubIngestionRuns({
    tenantId: tenant.id,
    status: rawStatus.length > 0 ? rawStatus : null,
    limit,
  });
  return apiHubJson({ runs: rows.map(toApiHubIngestionRunDto) }, requestId);
}

export async function POST(request: Request) {
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

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const connectorId =
    typeof body.connectorId === "string" && body.connectorId.trim().length > 0 ? body.connectorId.trim() : null;
  const rawBodyIdempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : null;
  const rawHeaderIdempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
  const idempotencyKey = (rawHeaderIdempotencyKey || rawBodyIdempotencyKey)?.slice(0, 128) ?? null;

  try {
    const created = await createApiHubIngestionRun({
      tenantId: tenant.id,
      actorUserId: actorId,
      connectorId,
      idempotencyKey,
    });
    return apiHubJson(
      { run: toApiHubIngestionRunDto(created.run), idempotentReplay: created.idempotentReplay },
      requestId,
      created.idempotentReplay ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "connector_not_found") {
      return apiHubJson({ error: "Connector not found for tenant." }, requestId, 404);
    }
    throw error;
  }
}
