import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../_lib/sctwin-api-log";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { listEdgesForEntity, listEdgesForTenant } from "@/lib/supply-chain-twin/edges-repo";

import { twinEdgesListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { parseTwinEdgesQuery } from "@/lib/supply-chain-twin/schemas/twin-edges-query";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/edges";

/**
 * Twin graph edges for the demo tenant. Same auth / visibility as entity catalog.
 * Query: zod-validated optional `fromSnapshotId`, `toSnapshotId`, or `snapshotId` + `direction`; `take` (1..500, default 200).
 */
export async function GET(request: Request) {
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
    }
    const { access } = gate;

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

    return NextResponse.json(twinEdgesListResponseSchema.parse({ edges }));
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
