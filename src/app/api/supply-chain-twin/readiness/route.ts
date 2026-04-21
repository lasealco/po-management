import { NextResponse } from "next/server";

import { logSctwinApiError } from "../_lib/sctwin-api-log";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
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
