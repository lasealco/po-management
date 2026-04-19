import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { deleteTariffRateLine, updateTariffRateLine } from "@/lib/tariff/rate-lines";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import type { TariffLineRateType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ versionId: string; lineId: string }> },
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
    const updated = await updateTariffRateLine(
      { tenantId: tenant.id, id: lineId },
      {
        ...(typeof o.originScopeId === "string" || o.originScopeId === null
          ? { originScopeId: typeof o.originScopeId === "string" ? o.originScopeId.trim() || null : null }
          : {}),
        ...(typeof o.destinationScopeId === "string" || o.destinationScopeId === null
          ? {
              destinationScopeId:
                typeof o.destinationScopeId === "string" ? o.destinationScopeId.trim() || null : null,
            }
          : {}),
        ...(typeof o.rateType === "string" ? { rateType: o.rateType.trim() as TariffLineRateType } : {}),
        ...(typeof o.equipmentType === "string" || o.equipmentType === null
          ? { equipmentType: typeof o.equipmentType === "string" ? o.equipmentType.trim() || null : null }
          : {}),
        ...(typeof o.unitBasis === "string" ? { unitBasis: o.unitBasis.trim() } : {}),
        ...(typeof o.currency === "string" ? { currency: o.currency.trim() } : {}),
        ...(o.amount !== undefined ? { amount: o.amount as number | string } : {}),
        ...(typeof o.rawRateDescription === "string" || o.rawRateDescription === null
          ? {
              rawRateDescription:
                typeof o.rawRateDescription === "string" ? o.rawRateDescription.trim() || null : null,
            }
          : {}),
        ...(typeof o.notes === "string" || o.notes === null
          ? { notes: typeof o.notes === "string" ? o.notes.trim() || null : null }
          : {}),
      },
    );
    await recordTariffAuditLog({
      objectType: "tariff_rate_line",
      objectId: lineId,
      action: "update",
      userId: actorId,
      newValue: { rateType: updated.rateType, amount: String(updated.amount) },
    });
    return NextResponse.json({ rateLine: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ versionId: string; lineId: string }> },
) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { lineId } = await context.params;

  try {
    await deleteTariffRateLine({ tenantId: tenant.id, id: lineId });
    await recordTariffAuditLog({
      objectType: "tariff_rate_line",
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
