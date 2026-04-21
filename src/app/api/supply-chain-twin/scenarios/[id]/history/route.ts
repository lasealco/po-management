import { logSctwinApiError, logSctwinApiWarn, resolveSctwinRequestId, twinApiJson } from "../../../_lib/sctwin-api-log";
import { twinScenarioHistoryListResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { listScenarioHistoryForTenant } from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

const ROUTE_GET = "GET /api/supply-chain-twin/scenarios/[id]/history";

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

    const items = await listScenarioHistoryForTenant(access.tenant.id, draftId);
    if (!items) {
      return twinApiJson({ error: "Not found." }, { status: 404 }, requestId);
    }

    return twinApiJson(
      twinScenarioHistoryListResponseSchema.parse({
        items: items.map((item) => ({
          id: item.id,
          createdAt: item.createdAt.toISOString(),
          actorId: item.actorId,
          action: item.action,
          titleBefore: item.titleBefore,
          titleAfter: item.titleAfter,
          statusBefore: item.statusBefore,
          statusAfter: item.statusAfter,
        })),
      }),
      undefined,
      requestId,
    );
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE_GET,
      phase: "scenario_history",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
