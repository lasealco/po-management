import { apiHubJson } from "@/lib/apihub/api-error";
import { getApiHubIngestionRunOpsSummary } from "@/lib/apihub/ingestion-runs-repo";
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
