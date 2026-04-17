import { NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

async function gateBuyerConsolidationAccess() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }
  const isSupplierPortalUser = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplierPortalUser) {
    return NextResponse.json(
      { error: "Supplier users cannot manage buyer consolidation." },
      { status: 403 },
    );
  }
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  return { tenant };
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; shipmentId: string }> },
) {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;
  const { id: loadPlanId, shipmentId } = await context.params;

  const row = await prisma.loadPlanShipment.findFirst({
    where: {
      loadPlanId,
      shipmentId,
      loadPlan: { tenantId: access.tenant.id },
    },
    include: {
      loadPlan: { select: { status: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  if (row.loadPlan.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only DRAFT load plans can be changed." },
      { status: 400 },
    );
  }

  await prisma.loadPlanShipment.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
