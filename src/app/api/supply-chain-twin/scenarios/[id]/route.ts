import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { logSctwinApiError, logSctwinApiWarn } from "../../_lib/sctwin-api-log";
import { parseTwinScenarioDraftPatchBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-patch";
import { twinScenarioDraftDetailResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import {
  getScenarioDraftByIdForTenant,
  patchScenarioDraftForTenant,
  type PatchScenarioDraftInput,
} from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/scenarios/[id]";
const ROUTE_PATCH = "PATCH /api/supply-chain-twin/scenarios/[id]";

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
        route: ROUTE_GET,
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
      route: ROUTE_GET,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Partial update of `title` and/or `draft` (stored as `draftJson`). Request body validated with Zod; draft JSON is
 * never written to structured logs.
 *
 * Optimistic concurrency (e.g. `If-Match` / `updatedAt` guards) is deferred — last write wins for now.
 *
 * **200:** Same JSON shape as `GET` (full draft after update). **404:** No row for tenant + id. **400:** Invalid path
 * id, invalid JSON body, or empty patch.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
      });
      return NextResponse.json({ error: "Invalid scenario draft id." }, { status: 400 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "BODY_JSON_INVALID",
      });
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = parseTwinScenarioDraftPatchBody(raw);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "BODY_VALIDATION_FAILED",
      });
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const patchInput: PatchScenarioDraftInput = {};
    if (parsed.body.title !== undefined) {
      patchInput.title = parsed.body.title;
    }
    if (parsed.body.draft !== undefined) {
      patchInput.draft = parsed.body.draft as Prisma.InputJsonValue;
    }

    const row = await patchScenarioDraftForTenant(access.tenant.id, draftId, patchInput);
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
      route: ROUTE_PATCH,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
