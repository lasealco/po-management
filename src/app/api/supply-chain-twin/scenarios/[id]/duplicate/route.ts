import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../../../_lib/sctwin-api-log";
import { parseTwinScenarioDraftDuplicateBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-duplicate";
import { twinScenarioDraftListItemSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { duplicateScenarioDraftForTenant } from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE_POST = "POST /api/supply-chain-twin/scenarios/[id]/duplicate";

/**
 * Duplicates a tenant scenario draft: new row, same `draftJson`, **`draft`** status, optional `titleSuffix` on the
 * request body (Zod). **Never logs request JSON** (only validation error codes / exception names).
 *
 * **404:** Source id not found for this tenant (cross-tenant ids included). **201:** New row id (differs from source).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }
    const { access } = gate;

    const { id: rawId } = await context.params;
    const sourceDraftId = rawId.trim();
    if (!sourceDraftId || sourceDraftId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE_POST,
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
        route: ROUTE_POST,
        phase: "validation",
        errorCode: "BODY_JSON_INVALID",
        requestId,
      });
      return twinApiErrorJson("Request body must be valid JSON.", 400, requestId, "BODY_JSON_INVALID");
    }

    const parsed = parseTwinScenarioDraftDuplicateBody(raw);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE_POST,
        phase: "validation",
        errorCode: "BODY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiErrorJson(parsed.error, 400, requestId, "BODY_VALIDATION_FAILED");
    }

    const row = await duplicateScenarioDraftForTenant(access.tenant.id, sourceDraftId, {
      titleSuffix: parsed.body.titleSuffix,
      actorId: access.user.id,
    });
    if (!row) {
      return twinApiErrorJson("Not found.", 404, requestId);
    }

    const body = {
      id: row.id,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
    };
    return twinApiJson(twinScenarioDraftListItemSchema.parse(body), { status: 201 }, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_POST,
      phase: "scenarios_duplicate",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
