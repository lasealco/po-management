import {
  apiHubDemoActorMissing,
  apiHubDemoTenantMissing,
  apiHubJson,
} from "@/lib/apihub/api-error";
import { getApiHubIngestionRunOpsSummary } from "@/lib/apihub/ingestion-runs-repo";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

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

  const summary = await getApiHubIngestionRunOpsSummary({ tenantId: tenant.id });
  return apiHubJson(
    {
      totals: summary.totals,
      windows: summary.windows,
      inFlight: summary.inFlight,
      totalRuns: summary.totalRuns,
      asOf: summary.asOf.toISOString(),
    },
    requestId,
  );
}
