import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffRateLine, listTariffRateLinesForTenantVersion } from "@/lib/tariff/rate-lines";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import type { TariffLineRateType } from "@prisma/client";

export const dynamic = "force-dynamic";

const RATE_TYPES = new Set<string>([
  "BASE_RATE",
  "ALL_IN",
  "GATE_IN",
  "GATE_IN_ALL_IN",
  "GATE_IN_GATE_OUT",
  "ADD_ON",
  "LOCAL_CHARGE",
  "SURCHARGE",
  "CUSTOMS",
  "PRE_CARRIAGE",
  "ON_CARRIAGE",
]);

export async function GET(_request: Request, context: { params: Promise<{ versionId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { versionId } = await context.params;
  try {
    const rateLines = await listTariffRateLinesForTenantVersion({
      tenantId: tenant.id,
      contractVersionId: versionId,
    });
    return NextResponse.json({ rateLines });
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
  const rateType = typeof o.rateType === "string" ? o.rateType.trim() : "";
  const unitBasis = typeof o.unitBasis === "string" ? o.unitBasis.trim() : "";
  const currency = typeof o.currency === "string" ? o.currency.trim() : "";
  const amount = o.amount;
  if (!rateType || !RATE_TYPES.has(rateType) || !unitBasis || !currency || amount === undefined || amount === null) {
    return NextResponse.json(
      { error: "rateType, unitBasis, currency, and amount are required." },
      { status: 400 },
    );
  }

  const { versionId } = await context.params;

  try {
    const created = await createTariffRateLine({
      tenantId: tenant.id,
      contractVersionId: versionId,
      originScopeId: typeof o.originScopeId === "string" ? o.originScopeId.trim() || null : null,
      destinationScopeId: typeof o.destinationScopeId === "string" ? o.destinationScopeId.trim() || null : null,
      rateType: rateType as TariffLineRateType,
      equipmentType: typeof o.equipmentType === "string" ? o.equipmentType.trim() || null : null,
      commodityScope: typeof o.commodityScope === "string" ? o.commodityScope.trim() || null : null,
      serviceScope: typeof o.serviceScope === "string" ? o.serviceScope.trim() || null : null,
      unitBasis,
      currency,
      amount: amount as number | string,
      rawRateDescription: typeof o.rawRateDescription === "string" ? o.rawRateDescription.trim() || null : null,
      notes: typeof o.notes === "string" ? o.notes.trim() || null : null,
    });
    await recordTariffAuditLog({
      objectType: "tariff_rate_line",
      objectId: created.id,
      action: "create",
      userId: actorId,
      newValue: { contractVersionId: versionId, rateType: created.rateType, amount: String(created.amount) },
    });
    return NextResponse.json({ rateLine: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
