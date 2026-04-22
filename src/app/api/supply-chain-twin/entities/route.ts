import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { twinEntitiesListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { decodeTwinEntitiesCursor, parseTwinEntitiesQuery } from "@/lib/supply-chain-twin/schemas/twin-entities-query";
import { listForTenantPage } from "@/lib/supply-chain-twin/repo";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/entities";

/**
 * Entity catalog backed by `SupplyChainTwinEntitySnapshot`.
 * Query: zod-validated `q`, `limit` (1..100, default 100), optional opaque `cursor` (keyset), optional **`entityKind`**
 * (strict allowlist — unknown values **400**; composes with `q` + cursor), optional **`fields`** (`summary`|`full`,
 * default `summary` — unknown **400**). In `summary` mode each item omits `payload` (0 on-wire bytes for that field).
 * Response: `{ items, nextCursor? }` — each item includes snapshot `id` (Prisma PK) plus `ref`; `nextCursor` omitted when there is no following page.
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
    const parsed = parseTwinEntitiesQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiErrorJson(parsed.error, 400, requestId, "QUERY_VALIDATION_FAILED");
    }

    if (parsed.query.cursor) {
      const decoded = decodeTwinEntitiesCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
          requestId,
        });
        return twinApiErrorJson("Invalid cursor", 400, requestId, "INVALID_CURSOR");
      }
    }

    const { items, nextCursor } = await listForTenantPage(access.tenant.id, {
      q: parsed.query.q,
      limit: parsed.query.limit,
      cursor: parsed.query.cursor ?? null,
      fields: parsed.query.fields,
      ...(parsed.query.entityKind !== undefined ? { entityKind: parsed.query.entityKind } : {}),
    });

    if (nextCursor) {
      return twinApiJson(twinEntitiesListResponseSchema.parse({ items, nextCursor }), undefined, requestId);
    }
    return twinApiJson(twinEntitiesListResponseSchema.parse({ items }), undefined, requestId);
  } catch (caught) {
    if (caught instanceof RangeError && caught.message === "INVALID_TWIN_ENTITIES_CURSOR") {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "INVALID_CURSOR",
        requestId,
      });
      return twinApiErrorJson("Invalid cursor", 400, requestId, "INVALID_CURSOR");
    }
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
