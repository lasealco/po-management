import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../../../_lib/sctwin-api-log";
import { listEntityNeighborsForTenant } from "@/lib/supply-chain-twin/edges-repo";
import { getEntitySnapshotByIdForTenant } from "@/lib/supply-chain-twin/repo";
import { twinEntityNeighborsResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { parseTwinEntityNeighborsQuery } from "@/lib/supply-chain-twin/schemas/twin-entity-neighbors-query";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/entities/[id]/neighbors";

/**
 * One-hop neighbor list for a tenant-scoped snapshot id. `direction` supports `in|out|both` (default both).
 * Returns 404 for missing or cross-tenant ids; empty `neighbors` list when no incident edges match filters.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }
    const { access } = gate;

    const { id: rawId } = await context.params;
    const snapshotId = rawId.trim();
    if (!snapshotId || snapshotId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
        requestId,
      });
      return twinApiErrorJson("Invalid entity id.", 400, requestId, "PATH_ID_INVALID");
    }

    const url = new URL(request.url);
    const parsed = parseTwinEntityNeighborsQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiErrorJson(parsed.error, 400, requestId, "QUERY_VALIDATION_FAILED");
    }

    const snapshot = await getEntitySnapshotByIdForTenant(access.tenant.id, snapshotId);
    if (!snapshot) {
      return twinApiErrorJson("Not found.", 404, requestId);
    }

    const neighbors = await listEntityNeighborsForTenant(access.tenant.id, snapshotId, {
      direction: parsed.query.direction,
      take: parsed.query.take,
    });

    return twinApiJson(twinEntityNeighborsResponseSchema.parse({ id: snapshotId, neighbors }), undefined, requestId);
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
