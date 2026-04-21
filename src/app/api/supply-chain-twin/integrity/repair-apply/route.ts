import { logSctwinApiError, logSctwinApiWarn, resolveSctwinRequestId, twinApiJson } from "../../_lib/sctwin-api-log";
import { applyTwinIntegrityRepairsForTenant } from "@/lib/supply-chain-twin/integrity-repair-apply";
import { appendTwinMutationAuditEvent } from "@/lib/supply-chain-twin/mutation-audit";
import {
  twinIntegrityRepairApplyBodySchema,
  twinIntegrityRepairApplySummarySchema,
} from "@/lib/supply-chain-twin/schemas/twin-integrity-repair-apply";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

const ROUTE = "POST /api/supply-chain-twin/integrity/repair-apply";

/**
 * Guarded apply mode for integrity repairs.
 * Requires explicit `confirmApply: true` and returns per-action audit records.
 */
export async function POST(request: Request) {
  const requestId = resolveSctwinRequestId(request);
  try {
    const gate = await requireTwinApiAccess();
    if (!gate.ok) {
      return twinApiJson({ error: gate.denied.error }, { status: gate.denied.status }, requestId);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return twinApiJson({ error: "Request body must be valid JSON." }, { status: 400 }, requestId);
    }
    const parsed = twinIntegrityRepairApplyBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return twinApiJson(
        { error: "confirmApply=true is required to execute integrity repair apply mode." },
        { status: 400 },
        requestId,
      );
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
    return twinApiJson({ error: "Internal server error" }, { status: 500 }, requestId);
  }
}
