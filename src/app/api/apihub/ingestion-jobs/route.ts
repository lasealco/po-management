import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
  type ApiHubValidationIssue,
} from "@/lib/apihub/api-error";
import { getApiHubConnectorInTenant } from "@/lib/apihub/connectors-repo";
import { APIHUB_INGESTION_JOB_STATUSES } from "@/lib/apihub/constants";
import { decodeIngestionRunListCursor } from "@/lib/apihub/ingestion-run-list-cursor";
import {
  parseIngestionRunListAttemptRangeParam,
  parseIngestionRunListConnectorIdParam,
  parseIngestionRunListTriggerKindParam,
} from "@/lib/apihub/ingestion-run-list-filters";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { createApiHubIngestionRun, listApiHubIngestionRuns } from "@/lib/apihub/ingestion-runs-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
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
    return apiHubDemoTenantMissing(requestId);
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
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

  const limitParsed = parseApiHubListLimitFromUrl(url);
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Run query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
      },
    ], requestId);
  }

  const listIssues: ApiHubValidationIssue[] = [];
  let connectorIdFilter: string | null = null;
  const connectorParse = parseIngestionRunListConnectorIdParam(url.searchParams.get("connectorId"));
  if (!connectorParse.ok) {
    listIssues.push(...connectorParse.issues);
  } else {
    connectorIdFilter = connectorParse.connectorId;
  }
  let triggerKindFilter: string | null = null;
  const triggerParse = parseIngestionRunListTriggerKindParam(url.searchParams.get("triggerKind"));
  if (!triggerParse.ok) {
    listIssues.push(...triggerParse.issues);
  } else {
    triggerKindFilter = triggerParse.triggerKind;
  }
  let attemptRangeFilter: { min: number; max: number } | null = null;
  const attemptParse = parseIngestionRunListAttemptRangeParam(url.searchParams.get("attemptRange"));
  if (!attemptParse.ok) {
    listIssues.push(...attemptParse.issues);
  } else {
    attemptRangeFilter = attemptParse.attemptRange;
  }
  if (listIssues.length > 0) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Run query validation failed.", listIssues, requestId);
  }

  if (connectorIdFilter) {
    const connector = await getApiHubConnectorInTenant(tenant.id, connectorIdFilter);
    if (!connector) {
      return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found for tenant.", requestId);
    }
  }

  const rawCursor = (url.searchParams.get("cursor") ?? "").trim();
  let listCursor: { createdAt: Date; id: string } | null = null;
  if (rawCursor.length > 0) {
    const decoded = decodeIngestionRunListCursor(rawCursor);
    if (!decoded.ok) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Run query validation failed.", [
        { field: "cursor", code: "INVALID_CURSOR", message: decoded.message },
      ], requestId);
    }
    listCursor = decoded.cursor;
  }

  const { items, nextCursor } = await listApiHubIngestionRuns({
    tenantId: tenant.id,
    status: rawStatus.length > 0 ? rawStatus : null,
    limit: limitParsed.limit,
    cursor: listCursor,
    connectorId: connectorIdFilter,
    triggerKind: triggerKindFilter,
    attemptRange: attemptRangeFilter,
  });
  return apiHubJson({ runs: items.map(toApiHubIngestionRunDto), nextCursor }, requestId);
}

export async function POST(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const tenant = await getDemoTenant();
  if (!tenant) {
    return apiHubDemoTenantMissing(requestId);
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return apiHubDemoActorMissing(requestId);
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
      return apiHubError(404, "CONNECTOR_NOT_FOUND", "Connector not found for tenant.", requestId);
    }
    throw error;
  }
}
