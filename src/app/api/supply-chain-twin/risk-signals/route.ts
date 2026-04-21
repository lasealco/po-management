import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
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
 * Tenant-scoped `SupplyChainTwinRiskSignal` rows, newest `createdAt` first, keyset-paged. Optional `severity` filter
 * matches Prisma `TwinRiskSeverity`. Titles and details are returned to the client only — not written to structured logs.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
    }
    const { access } = gate;

    const url = new URL(request.url);
    const parsed = parseTwinRiskSignalsListQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
      });
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let cursorPosition: { createdAt: Date; id: string } | null = null;
    if (parsed.query.cursor) {
      const decoded = decodeTwinRiskSignalsListCursor(parsed.query.cursor);
      if (!decoded.ok) {
        logSctwinApiWarn({
          route: ROUTE,
          phase: "validation",
          errorCode: "INVALID_CURSOR",
        });
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
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

    return NextResponse.json(twinRiskSignalsListResponseSchema.parse(body));
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "risk-signals",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
