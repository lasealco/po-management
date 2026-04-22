import {
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  twinApiErrorJson,
  twinApiJson,
} from "../../_lib/sctwin-api-log";
import { applyTwinIntegrityRepairsForTenant } from "@/lib/supply-chain-twin/integrity-repair-apply";
import { appendTwinMutationAuditEvent } from "@/lib/supply-chain-twin/mutation-audit";
import {
  twinIntegrityRepairApplyBodySchema,
  twinIntegrityRepairApplySummarySchema,
} from "@/lib/supply-chain-twin/schemas/twin-integrity-repair-apply";
import { requireTwinMaintenanceAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "POST /api/supply-chain-twin/integrity/repair-apply";

/**
 * Guarded apply mode for integrity repairs.
 * Requires explicit `confirmApply: true` and returns per-action audit records.
 */
export async function POST(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinMaintenanceAccess();
    if (!gate.ok) {
      return twinApiErrorJson(gate.denied.error, gate.denied.status, requestId);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return twinApiErrorJson("Request body must be valid JSON.", 400, requestId);
    }
    const parsed = twinIntegrityRepairApplyBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return twinApiErrorJson("confirmApply=true is required to execute integrity repair apply mode.", 400, requestId);
    }

    const result = await applyTwinIntegrityRepairsForTenant(gate.access.tenant.id, {
      maxActions: parsed.data.maxActions,
    });

    try {
      await appendTwinMutationAuditEvent({
        tenantId: gate.access.tenant.id,
        actorId: gate.access.user.id,
        action: "integrity_repair_apply_executed",
        metadata: {
          attemptedActionCount: result.attemptedActionCount,
          appliedActionCount: result.appliedActionCount,
        },
      });
    } catch {
      logSctwinApiWarn({
        route: ROUTE,
        phase: "catalog",
        errorCode: "AUDIT_WRITE_FAILED",
        requestId,
      });
    }

    return twinApiJson(twinIntegrityRepairApplySummarySchema.parse(result), undefined, requestId);
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : "non_error_throw";
    logSctwinApiError({
      route: ROUTE,
      phase: "catalog",
      errorCode: "UNHANDLED_EXCEPTION",
      detail: name,
      requestId,
    });
    return twinApiErrorJson("Internal server error", 500, requestId);
  }
}
