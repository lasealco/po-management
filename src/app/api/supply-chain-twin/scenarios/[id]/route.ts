import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiJson,
  withSctwinRequestId,
} from "../../_lib/sctwin-api-log";
import { parseTwinScenarioDraftPatchBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-patch";
import { twinScenarioDraftDetailResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import {
  deleteScenarioDraftForTenant,
  getScenarioDraftByIdForTenant,
  patchScenarioDraftForTenant,
  type PatchScenarioDraftInput,
  type PatchScenarioDraftResult,
} from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/scenarios/[id]";
const ROUTE_PATCH = "PATCH /api/supply-chain-twin/scenarios/[id]";
const ROUTE_DELETE = "DELETE /api/supply-chain-twin/scenarios/[id]";

/**
 * Single tenant-scoped `SupplyChainTwinScenarioDraft` by primary key.
 *
 * **200 JSON:** `{ id, title, status, createdAt, updatedAt, draft }` — ISO timestamps; `draft` is the stored JSON (not written to structured logs).
 * **404:** No row for this tenant + id (includes other tenants; same error body).
 * **400:** Malformed path `id` (empty / too long).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }
    const { access } = gate;

    const { id: rawId } = await context.params;
    const draftId = rawId.trim();
    if (!draftId || draftId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE_GET,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Invalid scenario draft id." }, { status: 400 }, requestId);
    }

    const row = await getScenarioDraftByIdForTenant(access.tenant.id, draftId);
    if (!row) {
      return twinApiJson({ error: "Not found." }, { status: 404 }, requestId);
    }

    const body = {
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      draft: row.draftJson,
    };
    return twinApiJson(twinScenarioDraftDetailResponseSchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_GET,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}

/**
 * Partial update of `title`, optional `draft` (`draftJson`), and/or **`status`** (`draft` | `archived` only in Zod).
 * Draft JSON is never written to structured logs.
 *
 * **Archived vs list:** rows with `status: archived` are **excluded** from the keyset list on
 * `GET /api/supply-chain-twin/scenarios` (repo filter). This `GET …/[id]` route still returns archived rows by id.
 *
 * Optimistic concurrency (e.g. `If-Match` / `updatedAt` guards) is deferred — last write wins for now.
 *
 * **200:** Same JSON shape as `GET` (full draft after update). **404:** No row for tenant + id. **400:** Invalid path
 * id, invalid JSON body, empty patch, invalid `status` enum, or disallowed status transition.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }
    const { access } = gate;

    const { id: rawId } = await context.params;
    const draftId = rawId.trim();
    if (!draftId || draftId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Invalid scenario draft id." }, { status: 400 }, requestId);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "BODY_JSON_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Request body must be valid JSON." }, { status: 400 }, requestId);
    }

    const parsed = parseTwinScenarioDraftPatchBody(raw);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "BODY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
    }

    const patchInput: PatchScenarioDraftInput = {};
    if (parsed.body.title !== undefined) {
      patchInput.title = parsed.body.title;
    }
    if (parsed.body.draft !== undefined) {
      patchInput.draft = parsed.body.draft as Prisma.InputJsonValue;
    }
    if (parsed.body.status !== undefined) {
      patchInput.status = parsed.body.status;
    }

    const patched: PatchScenarioDraftResult = await patchScenarioDraftForTenant(
      access.tenant.id,
      draftId,
      patchInput,
    );
    if (!patched.ok) {
      if (patched.reason === "not_found") {
        return twinApiJson({ error: "Not found." }, { status: 404 }, requestId);
      }
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "INVALID_STATUS_TRANSITION",
        requestId,
      });
      return twinApiJson({ error: patched.message }, { status: 400 }, requestId);
    }
    const row = patched.row;

    const body = {
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      draft: row.draftJson,
    };
    return twinApiJson(twinScenarioDraftDetailResponseSchema.parse(body), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_PATCH,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}

/**
 * **Hard delete** — removes the `SupplyChainTwinScenarioDraft` row for this tenant and id.
 *
 * No other Prisma models reference scenario drafts today, so deleting a draft does not cascade into child rows.
 * The draft→tenant FK uses `onDelete: Cascade` from `Tenant` to drafts (deleting a tenant removes its drafts), not
 * the reverse.
 *
 * **204:** Deleted. **404:** No row for tenant + id. **400:** Invalid path id. Same auth gate as `GET` / `PATCH`.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }
    const { access } = gate;

    const { id: rawId } = await context.params;
    const draftId = rawId.trim();
    if (!draftId || draftId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE_DELETE,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Invalid scenario draft id." }, { status: 400 }, requestId);
    }

    const deleted = await deleteScenarioDraftForTenant(access.tenant.id, draftId);
    if (!deleted) {
      return twinApiJson({ error: "Not found." }, { status: 404 }, requestId);
    }

    return withSctwinRequestId(new NextResponse(null, { status: 204 }), requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_DELETE,
      phase: "scenarios",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
