import type { CtAlertSeverity, TwinRiskSeverity } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { getScriEventForTenant } from "@/lib/scri/event-repo";

export const dynamic = "force-dynamic";

function mapTwinToCtSeverity(s: TwinRiskSeverity): CtAlertSeverity {
  switch (s) {
    case "CRITICAL":
    case "HIGH":
      return "CRITICAL";
    case "MEDIUM":
    case "LOW":
      return "WARN";
    default:
      return "INFO";
  }
}

/**
 * Create a Control Tower alert on the first impacted shipment for this SCRI event (Phase H downstream).
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const scriGate = await requireApiGrant("org.scri", "edit");
  if (scriGate) return scriGate;

  const ctGate = await requireApiGrant("org.controltower", "edit");
  if (ctGate) return ctGate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({
      error: "No active demo user for this session.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const { id: eventId } = await ctx.params;
  const event = await getScriEventForTenant(tenant.id, eventId);
  if (!event) {
    return toApiErrorResponse({ error: "Event not found.", code: "NOT_FOUND", status: 404 });
  }

  const shipmentHit = event.affectedEntities
    .filter((a) => a.objectType === "SHIPMENT")
    .sort((a, b) => b.matchConfidence - a.matchConfidence)[0];
  if (!shipmentHit) {
    return toApiErrorResponse({
      error: "No shipment match on this event. Run R2 matching after geography is present.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentHit.objectId, order: { tenantId: tenant.id } },
    select: { id: true },
  });
  if (!shipment) {
    return toApiErrorResponse({ error: "Shipment not found for tenant.", code: "NOT_FOUND", status: 404 });
  }

  const title = `Risk intelligence: ${event.title}`.slice(0, 512);
  const body = [
    `SCRI event ${event.id} (${event.eventType}, ${event.severity}).`,
    `Matched shipment ${shipment.id} (${shipmentHit.matchType}, ${shipmentHit.matchConfidence}%).`,
    event.shortSummary ? event.shortSummary.slice(0, 1500) : null,
  ]
    .filter(Boolean)
    .join("\n");

  const alert = await prisma.ctAlert.create({
    data: {
      tenantId: tenant.id,
      shipmentId: shipment.id,
      type: "SCRI_EVENT",
      severity: mapTwinToCtSeverity(event.severity),
      title,
      body,
      ownerUserId: actorId,
      status: "OPEN",
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    alertId: alert.id,
    shipmentId: shipment.id,
    ctPath: `/control-tower/shipments/${shipment.id}`,
  });
}
