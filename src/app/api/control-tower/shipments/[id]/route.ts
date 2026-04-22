import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { ensureBookingConfirmationSlaAlerts } from "@/lib/control-tower/booking-sla";
import { ensureSlaEscalationsForShipment } from "@/lib/control-tower/sla-escalation";
import { getShipment360 } from "@/lib/control-tower/shipment-360";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);

  const { id } = await context.params;
  if (!ctx.isRestrictedView) {
    await ensureBookingConfirmationSlaAlerts({
      tenantId: tenant.id,
      shipmentIds: [id],
    });
    await ensureSlaEscalationsForShipment({
      tenantId: tenant.id,
      shipmentId: id,
      actorUserId: actorId,
    });
  }
  const data = await getShipment360({
    tenantId: tenant.id,
    shipmentId: id,
    ctx,
    actorUserId: actorId,
  });
  if (!data) {
    return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  }
  return NextResponse.json(data);
}
