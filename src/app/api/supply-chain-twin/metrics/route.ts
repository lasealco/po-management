import { NextResponse } from "next/server";

import { logSctwinApiError } from "../_lib/sctwin-api-log";
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
export async function GET(_request: Request) {
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
    }

    const counts = await getTwinCatalogMetricsForTenant(gate.access.tenant.id);
    return NextResponse.json(twinCatalogMetricsResponseSchema.parse(counts));
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "metrics",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
