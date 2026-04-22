import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { listEdgesForEntity, listEdgesForTenant } from "@/lib/supply-chain-twin/edges-repo";

import { twinEdgesListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { parseTwinEdgesQuery } from "@/lib/supply-chain-twin/schemas/twin-edges-query";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/edges";

/**
 * Twin graph edges for the demo tenant. Same auth / visibility as entity catalog.
 * Query: zod-validated optional `fromSnapshotId`, `toSnapshotId`, graph aliases **`fromEntityId`** / **`toEntityId`**
 * (same values as snapshot PKs; Slice 75 — mutually exclusive with the `*SnapshotId` twin and with each other), or
 * `snapshotId` + `direction` for the star pattern; `take` (1..500, default 200). Aliases resolve to indexed `where`
 * clauses on `fromSnapshotId` / `toSnapshotId` (no extra round trip).
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }
    const { access } = gate;

    const url = new URL(request.url);
    const parsed = parseTwinEdgesQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiErrorJson(parsed.error, 400, requestId, "QUERY_VALIDATION_FAILED");
    }

    const q = parsed.query;
    const tenantId = access.tenant.id;

    const edges = q.snapshotId
      ? await listEdgesForEntity(tenantId, q.snapshotId, {
          direction: q.direction,
          take: q.take,
        })
      : await listEdgesForTenant(tenantId, {
          fromSnapshotId: q.fromSnapshotId,
          toSnapshotId: q.toSnapshotId,
          take: q.take,
        });

    return twinApiJson(twinEdgesListResponseSchema.parse({ edges }), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "edges",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
