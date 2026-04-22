import { logSctwinApiError, resolveSctwinRequestId, twinApiErrorJson, twinApiJson } from "../_lib/sctwin-api-log";
import { getTwinIntegritySummaryForTenant } from "@/lib/supply-chain-twin/integrity-checker";
import { twinIntegrityCheckSummarySchema } from "@/lib/supply-chain-twin/schemas/twin-integrity-check";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/integrity";

/**
 * Read-only tenant integrity checker for Twin references.
 * No writes are performed; response includes summary counts and sample ids.
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }

    const body = await getTwinIntegritySummaryForTenant(gate.access.tenant.id);
    return twinApiJson(twinIntegrityCheckSummarySchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "catalog",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
