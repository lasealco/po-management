import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import { decodeTwinEntitiesCursor, parseTwinEntitiesQuery } from "@/lib/supply-chain-twin/entities-catalog";
import { listForTenantPage } from "@/lib/supply-chain-twin/repo";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/entities";

/**
 * Entity catalog backed by `SupplyChainTwinEntitySnapshot`.
 * Query: zod-validated `q`, `limit` (1..100, default 100), optional opaque `cursor` (keyset).
 * Response: `{ items, nextCursor? }` — `nextCursor` omitted when there is no following page.
 */
export async function GET(request: Request) {
  try {
    const access = await getViewerGrantSet();
    if (!access?.user) {
      return NextResponse.json(
        {
          error:
            "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
        },
        { status: 403 },
      );
    }

    const { linkVisibility } = await resolveNavState(access);
    if (!linkVisibility?.supplyChainTwin) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Supply Chain Twin preview requires broader workspace access than this session has.",
        },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const parsed = parseTwinEntitiesQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
      });
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (parsed.query.cursor) {
      const decoded = decodeTwinEntitiesCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
        });
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
    }

    const { items, nextCursor } = await listForTenantPage(access.tenant.id, {
      q: parsed.query.q,
      limit: parsed.query.limit,
      cursor: parsed.query.cursor ?? null,
    });

    if (nextCursor) {
      return NextResponse.json({ items, nextCursor });
    }
    return NextResponse.json({ items });
  } catch (caught) {
    if (caught instanceof RangeError && caught.message === "INVALID_TWIN_ENTITIES_CURSOR") {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "INVALID_CURSOR",
      });
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "catalog",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
