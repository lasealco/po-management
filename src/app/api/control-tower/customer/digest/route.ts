import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import {
  controlTowerShipmentScopeWhere,
  getControlTowerPortalContext,
} from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);
  const scope = controlTowerShipmentScopeWhere(tenant.id, ctx);
  const shipments = await prisma.shipment.findMany({
    where: scope,
    select: {
      id: true,
      shipmentNo: true,
      status: true,
      booking: { select: { eta: true, latestEta: true, originCode: true, destinationCode: true } },
      milestones: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { code: true, actualAt: true },
      },
    },
    take: 250,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    view: {
      restricted: ctx.isRestrictedView,
      supplierPortal: ctx.isSupplierPortal,
      customerCrmAccountId: ctx.customerCrmAccountId,
    },
    items: shipments.map((s) => ({
      id: s.id,
      shipmentNo: s.shipmentNo,
      status: s.status,
      eta: s.booking?.latestEta?.toISOString() ?? s.booking?.eta?.toISOString() ?? null,
      originCode: s.booking?.originCode ?? null,
      destinationCode: s.booking?.destinationCode ?? null,
      latestMilestone: s.milestones[0]
        ? { code: s.milestones[0].code, hasActual: Boolean(s.milestones[0].actualAt) }
        : null,
    })),
  });
}
