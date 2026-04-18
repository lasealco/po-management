import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffChargeLine, listTariffChargeLinesForTenantVersion } from "@/lib/tariff/charge-lines";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { versionId } = await context.params;
  try {
    const chargeLines = await listTariffChargeLinesForTenantVersion({
      tenantId: tenant.id,
      contractVersionId: versionId,
    });
    return NextResponse.json({ chargeLines });
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
  const rawChargeName = typeof o.rawChargeName === "string" ? o.rawChargeName.trim() : "";
  const unitBasis = typeof o.unitBasis === "string" ? o.unitBasis.trim() : "";
  const currency = typeof o.currency === "string" ? o.currency.trim() : "";
  const amount = o.amount;
  if (!rawChargeName || !unitBasis || !currency || amount === undefined || amount === null) {
    return NextResponse.json(
      { error: "rawChargeName, unitBasis, currency, and amount are required." },
      { status: 400 },
    );
  }

  const { versionId } = await context.params;

  try {
    const created = await createTariffChargeLine({
      tenantId: tenant.id,
      contractVersionId: versionId,
      normalizedChargeCodeId:
        typeof o.normalizedChargeCodeId === "string" ? o.normalizedChargeCodeId.trim() || null : null,
      rawChargeName,
      geographyScopeId: typeof o.geographyScopeId === "string" ? o.geographyScopeId.trim() || null : null,
      unitBasis,
      currency,
      amount: amount as number | string,
      isIncluded: typeof o.isIncluded === "boolean" ? o.isIncluded : undefined,
      isMandatory: typeof o.isMandatory === "boolean" ? o.isMandatory : undefined,
      notes: typeof o.notes === "string" ? o.notes.trim() || null : null,
    });
    await recordTariffAuditLog({
      objectType: "tariff_charge_line",
      objectId: created.id,
      action: "create",
      userId: actorId,
      newValue: {
        contractVersionId: versionId,
        rawChargeName: created.rawChargeName,
        amount: String(created.amount),
      },
    });
    return NextResponse.json({ chargeLine: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
