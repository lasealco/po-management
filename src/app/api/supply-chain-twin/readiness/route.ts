import { logSctwinApiError, resolveSctwinRequestId, twinApiErrorJson, twinApiJson } from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { getSupplyChainTwinReadinessSnapshot } from "@/lib/supply-chain-twin/readiness";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/readiness";

/**
 * JSON contract: `{ ok, reasons, healthIndex, hasTwinData }`. Same visibility as the Twin preview (cross-module demo grants).
 * Reasons are operator-facing strings only (no PII). `?refresh=1` bypasses the short readiness cache.
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }

    const url = new URL(request.url);
    const bypassCache =
      url.searchParams.get("refresh") === "1" || url.searchParams.get("refresh") === "true";

    const readiness = await getSupplyChainTwinReadinessSnapshot({ bypassCache });
    return twinApiJson(readiness, undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "readiness",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
