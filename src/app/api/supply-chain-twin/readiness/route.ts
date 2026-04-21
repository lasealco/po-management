import { NextResponse } from "next/server";

import { logSctwinApiError } from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { getSupplyChainTwinReadinessSnapshot } from "@/lib/supply-chain-twin/readiness";
import { twinReadinessResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-readiness-response";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/readiness";

/**
 * JSON contract: `{ ok, reasons, healthIndex }`. Same visibility as the Twin preview (cross-module demo grants).
 * Reasons are operator-facing strings only (no PII). `?refresh=1` bypasses the short readiness cache.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
    }

    const url = new URL(request.url);
    const bypassCache =
      url.searchParams.get("refresh") === "1" || url.searchParams.get("refresh") === "true";

    const readiness = await getSupplyChainTwinReadinessSnapshot({ bypassCache });
    return NextResponse.json(twinReadinessResponseSchema.parse(readiness));
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "readiness",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
