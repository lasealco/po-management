import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../../_lib/sctwin-api-log";
import { getEntitySnapshotByIdForTenant } from "@/lib/supply-chain-twin/repo";
import { twinEntitySnapshotDetailResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/entities/[id]";

/**
 * Single tenant-scoped `SupplyChainTwinEntitySnapshot` by primary key.
 *
 * **200 JSON:** `{ id, ref: { kind, id }, createdAt, updatedAt, payload }` — ISO-8601 timestamps; `payload` is the stored JSON document.
 * **404:** No row for this tenant + id (includes wrong-tenant access; do not distinguish in the response body).
 * **400:** Malformed path `id` (empty / too long).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.denied.error }, { status: gate.denied.status });
    }
    const { access } = gate;

    const { id: rawId } = await context.params;
    const snapshotId = rawId.trim();
    if (!snapshotId || snapshotId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
      });
      return NextResponse.json({ error: "Invalid entity id." }, { status: 400 });
    }

    const row = await getEntitySnapshotByIdForTenant(access.tenant.id, snapshotId);
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = {
      id: row.id,
      ref: row.ref,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      payload: row.payload,
    };
    return NextResponse.json(twinEntitySnapshotDetailResponseSchema.parse(body));
  } catch (caught) {
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
