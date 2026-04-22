import { logSctwinApiError, resolveSctwinRequestId, twinApiErrorJson, twinApiJson } from "../_lib/sctwin-api-log";
import { twinCatalogMetricsResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { getTwinCatalogMetricsForTenant } from "@/lib/supply-chain-twin/twin-catalog-metrics";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/metrics";

/**
 * Tenant-scoped catalog **counts** for the Supply Chain Twin preview (entities, edges, ingest events, scenario drafts,
 * risk signals), **`entityCountsByKind`** (bounded keys, unknown kinds in `other`), plus `generatedAt` (ISO-8601) for UI
 * freshness. Counts use indexed `COUNT` / `GROUP BY` — no payload reads (see `getTwinCatalogMetricsForTenant` JSDoc).
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }

    const counts = await getTwinCatalogMetricsForTenant(gate.access.tenant.id);
    const body = { ...counts, generatedAt: new Date().toISOString() };
    return twinApiJson(twinCatalogMetricsResponseSchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "metrics",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
