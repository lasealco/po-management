import { logSctwinApiError, logSctwinApiWarn, resolveSctwinRequestId, twinApiJson } from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { twinEntitiesListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { decodeTwinEntitiesCursor, parseTwinEntitiesQuery } from "@/lib/supply-chain-twin/schemas/twin-entities-query";
import { listForTenantPage } from "@/lib/supply-chain-twin/repo";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/entities";

/**
 * Entity catalog backed by `SupplyChainTwinEntitySnapshot`.
 * Query: zod-validated `q`, `limit` (1..100, default 100), optional opaque `cursor` (keyset), optional **`entityKind`**
 * (strict allowlist — unknown values **400**; composes with `q` + cursor).
 * Response: `{ items, nextCursor? }` — each item includes snapshot `id` (Prisma PK) plus `ref`; `nextCursor` omitted when there is no following page.
 */
export async function GET(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
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
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
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
        return twinApiJson({ error: "Invalid cursor" }, { status: 400 }, requestId);
      }
    }

    const { items, nextCursor } = await listForTenantPage(access.tenant.id, {
      q: parsed.query.q,
      limit: parsed.query.limit,
      cursor: parsed.query.cursor ?? null,
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
      return twinApiJson({ error: "Invalid cursor" }, { status: 400 }, requestId);
    }
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
