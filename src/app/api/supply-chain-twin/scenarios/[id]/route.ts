import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../../_lib/sctwin-api-log";
import { twinScenarioDraftDetailResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { getScenarioDraftByIdForTenant } from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE = "GET /api/supply-chain-twin/scenarios/[id]";

/**
 * Single tenant-scoped `SupplyChainTwinScenarioDraft` by primary key.
 *
 * **200 JSON:** `{ id, title, status, createdAt, updatedAt, draft }` — ISO timestamps; `draft` is the stored JSON (not written to structured logs).
 * **404:** No row for this tenant + id (includes other tenants; same error body).
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
    const draftId = rawId.trim();
    if (!draftId || draftId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
      });
      return NextResponse.json({ error: "Invalid scenario draft id." }, { status: 400 });
    }

    const row = await getScenarioDraftByIdForTenant(access.tenant.id, draftId);
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = {
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      draft: row.draftJson,
    };
    return NextResponse.json(twinScenarioDraftDetailResponseSchema.parse(body));
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
