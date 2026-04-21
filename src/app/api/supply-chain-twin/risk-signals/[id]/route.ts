import { logSctwinApiError, logSctwinApiWarn, resolveSctwinRequestId, twinApiJson } from "../../_lib/sctwin-api-log";
import { appendTwinMutationAuditEvent } from "@/lib/supply-chain-twin/mutation-audit";
import { patchRiskSignalAckForTenant } from "@/lib/supply-chain-twin/risk-signals-repo";
import { twinRiskSignalAckPatchResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { parseTwinRiskSignalAckPatchBody } from "@/lib/supply-chain-twin/schemas/twin-risk-signal-ack-patch";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "PATCH /api/supply-chain-twin/risk-signals/[id]";

/**
 * Tenant-scoped acknowledge/unacknowledge for one risk signal.
 *
 * **Body:** `{ acknowledged: boolean }`
 * **200:** `{ id, acknowledged, acknowledgedAt, acknowledgedByActorId }`
 * **404:** Missing or cross-tenant id (same response).
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
    const riskSignalId = rawId.trim();
    if (!riskSignalId || riskSignalId.length > 128) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "PATH_ID_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Invalid risk signal id." }, { status: 400 }, requestId);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "BODY_JSON_INVALID",
        requestId,
      });
      return twinApiJson({ error: "Request body must be valid JSON." }, { status: 400 }, requestId);
    }

    const parsed = parseTwinRiskSignalAckPatchBody(raw);
    if (!parsed.ok) {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "validation",
        errorCode: "BODY_VALIDATION_FAILED",
        requestId,
      });
      return twinApiJson({ error: parsed.error }, { status: 400 }, requestId);
    }

    const patched = await patchRiskSignalAckForTenant(access.tenant.id, riskSignalId, {
      acknowledged: parsed.body.acknowledged,
      actorId: access.user.id,
    });
    if (!patched.ok) {
      return twinApiJson({ error: "Not found." }, { status: 404 }, requestId);
    }

    const body = twinRiskSignalAckPatchResponseSchema.parse({
      id: patched.row.id,
      acknowledged: patched.row.acknowledged,
      acknowledgedAt: patched.row.acknowledgedAt?.toISOString() ?? null,
      acknowledgedByActorId: patched.row.acknowledgedByActorId,
    });

    try {
      await appendTwinMutationAuditEvent({
        tenantId: access.tenant.id,
        actorId: access.user.id,
        action: "risk_signal_ack_patched",
        targetId: patched.row.id,
        metadata: { acknowledged: patched.row.acknowledged },
      });
    } catch {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "risk-signals",
        errorCode: "AUDIT_WRITE_FAILED",
        requestId,
      });
    }
    return twinApiJson(body, undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "risk-signals",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
