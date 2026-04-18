import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { deleteTariffChargeLine, updateTariffChargeLine } from "@/lib/tariff/charge-lines";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ lineId: string }> },
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
  const { lineId } = await context.params;

  try {
    const updated = await updateTariffChargeLine(
      { tenantId: tenant.id, id: lineId },
      {
        ...(typeof o.normalizedChargeCodeId === "string" || o.normalizedChargeCodeId === null
          ? {
              normalizedChargeCodeId:
                typeof o.normalizedChargeCodeId === "string" ? o.normalizedChargeCodeId.trim() || null : null,
            }
          : {}),
        ...(typeof o.rawChargeName === "string" ? { rawChargeName: o.rawChargeName.trim() } : {}),
        ...(typeof o.geographyScopeId === "string" || o.geographyScopeId === null
          ? {
              geographyScopeId:
                typeof o.geographyScopeId === "string" ? o.geographyScopeId.trim() || null : null,
            }
          : {}),
        ...(typeof o.unitBasis === "string" ? { unitBasis: o.unitBasis.trim() } : {}),
        ...(typeof o.currency === "string" ? { currency: o.currency.trim() } : {}),
        ...(o.amount !== undefined ? { amount: o.amount as number | string } : {}),
        ...(typeof o.isIncluded === "boolean" ? { isIncluded: o.isIncluded } : {}),
        ...(typeof o.isMandatory === "boolean" ? { isMandatory: o.isMandatory } : {}),
        ...(typeof o.notes === "string" || o.notes === null
          ? { notes: typeof o.notes === "string" ? o.notes.trim() || null : null }
          : {}),
      },
    );
    await recordTariffAuditLog({
      objectType: "tariff_charge_line",
      objectId: lineId,
      action: "update",
      userId: actorId,
      newValue: { rawChargeName: updated.rawChargeName, amount: String(updated.amount) },
    });
    return NextResponse.json({ chargeLine: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ lineId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { lineId } = await context.params;

  try {
    await deleteTariffChargeLine({ tenantId: tenant.id, id: lineId });
    await recordTariffAuditLog({
      objectType: "tariff_charge_line",
      objectId: lineId,
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
