import {
  apiHubJson,
  apiHubValidationError,
} from "@/lib/apihub/api-error";
import { getApiHubIngestionAlertsSummary } from "@/lib/apihub/ingestion-alerts-summary-repo";
import {
  APIHUB_LIST_LIMIT_MAX,
  APIHUB_LIST_LIMIT_MIN,
  parseApiHubListLimitFromUrl,
} from "@/lib/apihub/query-limit";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { apiHubEnsureTenantActorGrants } from "@/lib/apihub/route-guards";

export const dynamic = "force-dynamic";

const ALERTS_SUMMARY_LIMIT_CAP = 50;

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
    return apiHubValidationError(400, "VALIDATION_ERROR", "Alerts summary query validation failed.", [
      {
        field: "limit",
        code: "INVALID_NUMBER",
        message: `limit must be a finite number between ${APIHUB_LIST_LIMIT_MIN} and ${APIHUB_LIST_LIMIT_MAX}.`,
        severity: "error",
      },
    ], requestId);
  }

  const summary = await getApiHubIngestionAlertsSummary({
    tenantId: tenant.id,
    limit: Math.min(limitParsed.limit, ALERTS_SUMMARY_LIMIT_CAP),
  });

  return apiHubJson(summary, requestId);
}
