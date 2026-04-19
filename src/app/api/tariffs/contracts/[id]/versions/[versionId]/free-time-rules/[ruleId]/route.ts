import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { deleteTariffFreeTimeRule, updateTariffFreeTimeRule } from "@/lib/tariff/free-time-rules";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import type { TariffRuleType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ruleId: string }> },
) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const { ruleId } = await context.params;

  try {
    const updated = await updateTariffFreeTimeRule(
      { tenantId: tenant.id, id: ruleId },
      {
        ...(typeof o.geographyScopeId === "string" || o.geographyScopeId === null
          ? {
              geographyScopeId:
                typeof o.geographyScopeId === "string" ? o.geographyScopeId.trim() || null : null,
            }
          : {}),
        ...(typeof o.ruleType === "string" ? { ruleType: o.ruleType.trim() as TariffRuleType } : {}),
        ...(typeof o.freeDays === "number" ? { freeDays: o.freeDays } : {}),
        ...(typeof o.importExportScope === "string" || o.importExportScope === null
          ? {
              importExportScope:
                typeof o.importExportScope === "string" ? o.importExportScope.trim() || null : null,
            }
          : {}),
        ...(typeof o.equipmentScope === "string" || o.equipmentScope === null
          ? {
              equipmentScope:
                typeof o.equipmentScope === "string" ? o.equipmentScope.trim() || null : null,
            }
          : {}),
        ...(typeof o.notes === "string" || o.notes === null
          ? { notes: typeof o.notes === "string" ? o.notes.trim() || null : null }
          : {}),
      },
    );
    await recordTariffAuditLog({
      objectType: "tariff_free_time_rule",
      objectId: ruleId,
      action: "update",
      userId: actorId,
      newValue: { ruleType: updated.ruleType, freeDays: updated.freeDays },
    });
    return NextResponse.json({ freeTimeRule: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ ruleId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { ruleId } = await context.params;

  try {
    await deleteTariffFreeTimeRule({ tenantId: tenant.id, id: ruleId });
    await recordTariffAuditLog({
      objectType: "tariff_free_time_rule",
      objectId: ruleId,
      action: "delete",
      userId: actorId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
