import { NextResponse } from "next/server";

import { logSctwinApiError } from "../_lib/sctwin-api-log";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import { getSupplyChainTwinReadinessSnapshot } from "@/lib/supply-chain-twin/readiness";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/readiness";

/**
 * JSON contract: `{ ok, reasons }`. Same visibility as the Twin preview (cross-module demo grants).
 * Reasons are operator-facing strings only (no PII).
 */
export async function GET() {
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

    const readiness = getSupplyChainTwinReadinessSnapshot();
    return NextResponse.json(readiness);
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
