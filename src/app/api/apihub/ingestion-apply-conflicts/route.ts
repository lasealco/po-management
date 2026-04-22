import {
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { decodeApplyConflictListCursor } from "@/lib/apihub/apply-conflict-list-cursor";
import { listApiHubApplyConflicts } from "@/lib/apihub/ingestion-apply-conflicts-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  const gate = await apiHubEnsureTenantActorGrants(requestId, "view");
  if (!gate.ok) {
    return gate.response;
  }
  const { tenant } = gate.ctx;

  const url = new URL(request.url);
  const limitParsed = parseApiHubListLimitFromUrl(url);
  if (!limitParsed.ok) {
    return apiHubValidationError(400, "VALIDATION_ERROR", "Apply conflict query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
        severity: "error",
      },
    ], requestId);
  }

  const rawCursor = (url.searchParams.get("cursor") ?? "").trim();
  let listCursor: { createdAt: Date; id: string } | null = null;
  if (rawCursor.length > 0) {
    const decoded = decodeApplyConflictListCursor(rawCursor);
    if (!decoded.ok) {
      return apiHubValidationError(400, "VALIDATION_ERROR", "Apply conflict query validation failed.", [
        { field: "cursor", code: "INVALID_CURSOR", message: decoded.message, severity: "error" },
      ], requestId);
    }
    listCursor = decoded.cursor;
  }

  const { items, nextCursor } = await listApiHubApplyConflicts({
    tenantId: tenant.id,
    limit: limitParsed.limit,
    cursor: listCursor,
  });

  return apiHubJson({ conflicts: items, nextCursor }, requestId);
}
