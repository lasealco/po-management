import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffFreeTimeRule, listTariffFreeTimeRulesForTenantVersion } from "@/lib/tariff/free-time-rules";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import type { TariffRuleType } from "@prisma/client";

export const dynamic = "force-dynamic";

const RULE_TYPES = new Set<string>([
  "DEMURRAGE",
  "DETENTION",
  "COMBINED_DD",
  "STORAGE",
  "PLUGIN",
  "OTHER",
]);

export async function GET(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { versionId } = await context.params;
  try {
    const freeTimeRules = await listTariffFreeTimeRulesForTenantVersion({
      tenantId: tenant.id,
      contractVersionId: versionId,
    });
    return NextResponse.json({ freeTimeRules });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function POST(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const ruleType = typeof o.ruleType === "string" ? o.ruleType.trim() : "";
  const freeDays = typeof o.freeDays === "number" ? o.freeDays : Number.NaN;
  if (!ruleType || !RULE_TYPES.has(ruleType) || !Number.isFinite(freeDays)) {
    return toApiErrorResponse({ error: "ruleType and freeDays are required.", code: "BAD_INPUT", status: 400 });
  }

  const { versionId } = await context.params;

  try {
    const created = await createTariffFreeTimeRule({
      tenantId: tenant.id,
      contractVersionId: versionId,
      geographyScopeId: typeof o.geographyScopeId === "string" ? o.geographyScopeId.trim() || null : null,
      ruleType: ruleType as TariffRuleType,
      freeDays,
      importExportScope: typeof o.importExportScope === "string" ? o.importExportScope.trim() || null : null,
      equipmentScope: typeof o.equipmentScope === "string" ? o.equipmentScope.trim() || null : null,
      notes: typeof o.notes === "string" ? o.notes.trim() || null : null,
    });
    await recordTariffAuditLog({
      objectType: "tariff_free_time_rule",
      objectId: created.id,
      action: "create",
      userId: actorId,
      newValue: { contractVersionId: versionId, ruleType: created.ruleType, freeDays: created.freeDays },
    });
    return NextResponse.json({ freeTimeRule: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
