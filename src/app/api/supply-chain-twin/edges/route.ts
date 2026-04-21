import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import { listEdgesForEntity, listEdgesForTenant } from "@/lib/supply-chain-twin/edges-repo";

import { parseTwinEdgesQuery } from "./edges-query";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/edges";

/**
 * Twin graph edges for the demo tenant. Same auth / visibility as entity catalog.
 * Query: zod-validated optional `fromSnapshotId`, `toSnapshotId`, or `snapshotId` + `direction`; `take` (1..500, default 200).
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
    const parsed = parseTwinEdgesQuery(url.searchParams);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "QUERY_VALIDATION_FAILED",
      });
      return NextResponse.json({ error: parsed.error }, { status: 400 });
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

    return NextResponse.json({ edges });
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "edges",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
