import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import { parseAttachTariffApplicationRequestBody } from "@/lib/tariff/attach-tariff-application-request-body";
import { prisma } from "@/lib/prisma";
import { attachTariffVersionToShipment, listTariffShipmentApplications } from "@/lib/tariff/shipment-tariff-applications";
import { addTariffShipmentApplicationSourceLabel } from "@/lib/tariff/tariff-shipment-application-labels";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id: shipmentId } = await context.params;
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    select: { id: true },
  });
  if (!shipment) {
    return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  }

  const applications = await listTariffShipmentApplications({ tenantId: tenant.id, shipmentId });
  return NextResponse.json({
    applications: applications.map((a) => addTariffShipmentApplicationSourceLabel(a)),
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: shipmentId } = await context.params;

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    select: { id: true },
  });
  if (!shipment) {
    return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const parsed = parseAttachTariffApplicationRequestBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "BAD_INPUT", status: 400 });
  }

  try {
    const row = await attachTariffVersionToShipment({
      tenantId: tenant.id,
      shipmentId,
      ...parsed.body,
      createdById: actorId,
    });
    return NextResponse.json({ application: addTariffShipmentApplicationSourceLabel(row) });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
