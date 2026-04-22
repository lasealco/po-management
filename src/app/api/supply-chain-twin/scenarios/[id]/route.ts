import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
  withSctwinRequestId,
} from "../../_lib/sctwin-api-log";
import { appendTwinMutationAuditEvent } from "@/lib/supply-chain-twin/mutation-audit";
import { TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-create";
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
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
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
      return twinApiErrorJson("Invalid scenario draft id.", 400, requestId, "PATH_ID_INVALID");
    }

    const row = await getScenarioDraftByIdForTenant(access.tenant.id, draftId);
    if (!row) {
      return twinApiErrorJson("Not found.", 404, requestId);
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
    return twinApiErrorJson("Internal server error", 500, requestId);
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
 * id, invalid JSON body, empty patch, invalid `status` enum, disallowed status transition, or oversize `draft`
 * (`code: TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE`, stable log `errorCode` — no draft contents in logs).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
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
      return twinApiErrorJson("Invalid scenario draft id.", 400, requestId, "PATH_ID_INVALID");
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
      return twinApiErrorJson("Request body must be valid JSON.", 400, requestId, "BODY_JSON_INVALID");
    }

    const parsed = parseTwinScenarioDraftPatchBody(raw);
    if (!parsed.ok) {
      const errorCode = parsed.draftJsonTooLarge ? TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE : "BODY_VALIDATION_FAILED";
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode,
        requestId,
      });
      if (parsed.draftJsonTooLarge) {
        return twinApiErrorJson(
          "Scenario draft JSON exceeds maximum size.",
          400,
          requestId,
          TWIN_SCENARIO_DRAFT_JSON_TOO_LARGE,
        );
      }
      return twinApiErrorJson(parsed.error, 400, requestId, "BODY_VALIDATION_FAILED");
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
    patchInput.actorId = access.user.id;

    const patched: PatchScenarioDraftResult = await patchScenarioDraftForTenant(
      access.tenant.id,
      draftId,
      patchInput,
    );
    if (!patched.ok) {
      if (patched.reason === "not_found") {
        return twinApiErrorJson("Not found.", 404, requestId);
      }
      logSctwinApiWarn({
        route: ROUTE_PATCH,
        phase: "validation",
        errorCode: "INVALID_STATUS_TRANSITION",
        requestId,
      });
      return twinApiErrorJson(patched.message, 400, requestId, "INVALID_STATUS_TRANSITION");
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
    return twinApiErrorJson("Internal server error", 500, requestId);
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
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
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
      return twinApiErrorJson("Invalid scenario draft id.", 400, requestId, "PATH_ID_INVALID");
    }

    const deleted = await deleteScenarioDraftForTenant(access.tenant.id, draftId);
    if (!deleted) {
      return twinApiErrorJson("Not found.", 404, requestId);
    }

    try {
      await appendTwinMutationAuditEvent({
        tenantId: access.tenant.id,
        actorId: access.user.id,
        action: "scenario_deleted",
        targetId: draftId,
      });
    } catch {
      logSctwinApiWarn({
        route: ROUTE_DELETE,
        phase: "scenarios",
        errorCode: "AUDIT_WRITE_FAILED",
        requestId,
      });
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
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
