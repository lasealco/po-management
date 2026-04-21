import { logSctwinApiError, resolveSctwinRequestId, twinApiJson } from "../_lib/sctwin-api-log";
import { twinCatalogMetricsResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { getTwinCatalogMetricsForTenant } from "@/lib/supply-chain-twin/twin-catalog-metrics";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/metrics";

/**
 * Tenant-scoped catalog **counts** for the Supply Chain Twin preview (entities, edges, ingest events, scenario drafts,
 * risk signals). Each value comes from an indexed `COUNT` — no payload reads, no unbounded scans (see
 * `getTwinCatalogMetricsForTenant` JSDoc).
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }

    const counts = await getTwinCatalogMetricsForTenant(gate.access.tenant.id);
    return twinApiJson(twinCatalogMetricsResponseSchema.parse(counts), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "metrics",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
