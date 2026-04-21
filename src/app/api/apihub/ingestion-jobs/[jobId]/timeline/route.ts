import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubError,
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { decodeIngestionRunTimelineCursor } from "@/lib/apihub/ingestion-run-timeline-cursor";
import { getApiHubIngestionRunTimelinePage } from "@/lib/apihub/ingestion-run-timeline-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
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
  const url = new URL(request.url);
  const limitParsed = parseApiHubListLimitFromUrl(url);
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Timeline query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
      },
    ], requestId);
  }

  const rawCursor = (url.searchParams.get("cursor") ?? "").trim();
  let cursorOffset = 0;
  if (rawCursor.length > 0) {
    const decoded = decodeIngestionRunTimelineCursor(rawCursor);
    if (!decoded.ok) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Timeline query validation failed.", [
        { field: "cursor", code: "INVALID_CURSOR", message: decoded.message },
      ], requestId);
    }
    cursorOffset = decoded.offset;
  }

  const page = await getApiHubIngestionRunTimelinePage({
    tenantId: tenant.id,
    runId: jobId,
    limit: limitParsed.limit,
    cursorOffset,
  });
  if (!page) {
    return apiHubError(404, "RUN_NOT_FOUND", "Run not found.", requestId);
  }

  return apiHubJson({ events: page.items, nextCursor: page.nextCursor }, requestId);
}
