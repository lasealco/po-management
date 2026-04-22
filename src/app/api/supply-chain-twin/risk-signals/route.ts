import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../_lib/sctwin-api-log";
import { listRiskSignalsForTenantPage } from "@/lib/supply-chain-twin/risk-signals-repo";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { twinRiskSignalsListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import {
  decodeTwinRiskSignalsListCursor,
  parseTwinRiskSignalsListQuery,
} from "@/lib/supply-chain-twin/schemas/twin-risk-signals-list-query";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/risk-signals";

/**
 * Tenant-scoped `SupplyChainTwinRiskSignal` rows, newest `createdAt` first, keyset-paged. Optional **`severity`**
 * query (strict `TwinRiskSeverity`; invalid → **400**; blank omitted) composes with **`limit`** + **`cursor`**.
 * Titles and details are returned to the client only — not written to structured logs.
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
    const parsed = parseTwinRiskSignalsListQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiErrorJson(parsed.error, 400, requestId, "QUERY_VALIDATION_FAILED");
    }

    let cursorPosition: { createdAt: Date; id: string } | null = null;
    if (parsed.query.cursor) {
      const decoded = decodeTwinRiskSignalsListCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
          requestId,
        });
        return twinApiErrorJson("Invalid cursor", 400, requestId, "INVALID_CURSOR");
      }
      cursorPosition = { createdAt: decoded.createdAt, id: decoded.id };
    }

    const { items, nextCursor } = await listRiskSignalsForTenantPage(access.tenant.id, {
      limit: parsed.query.limit,
      cursorPosition,
      ...(parsed.query.severity ? { severity: parsed.query.severity } : {}),
    });

    const body = {
      items: items.map((row) => ({
        id: row.id,
        code: row.code,
        severity: row.severity,
        title: row.title,
        detail: row.detail,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      ...(nextCursor ? { nextCursor } : {}),
    };

    return twinApiJson(twinRiskSignalsListResponseSchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "risk-signals",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
