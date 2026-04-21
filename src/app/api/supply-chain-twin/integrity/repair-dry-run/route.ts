import { logSctwinApiError, resolveSctwinRequestId, twinApiJson } from "../../_lib/sctwin-api-log";
import { getTwinIntegrityRepairDryRunForTenant } from "@/lib/supply-chain-twin/integrity-repair-dry-run";
import { twinIntegrityRepairDryRunSummarySchema } from "@/lib/supply-chain-twin/schemas/twin-integrity-repair-dry-run";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/integrity/repair-dry-run";

/**
 * Read-only dry-run planner for integrity repairs.
 * Returns machine-readable proposed actions and does not apply writes.
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }

    const body = await getTwinIntegrityRepairDryRunForTenant(gate.access.tenant.id);
    return twinApiJson(twinIntegrityRepairDryRunSummarySchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "catalog",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
