import { NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }
  const isSupplier = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplier) {
    return NextResponse.json(
      { error: "Supplier users cannot validate ASN shipments." },
      { status: 403 },
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const { id: shipmentId } = await context.params;
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    select: { id: true, status: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  }
  if (
    shipment.status !== "SHIPPED" &&
    shipment.status !== "VALIDATED" &&
    shipment.status !== "BOOKED"
  ) {
    return NextResponse.json(
      { error: `Shipment in status ${shipment.status} cannot be validated.` },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: shipment.status === "BOOKED" ? "BOOKED" : "VALIDATED",
      },
    });
    await tx.shipmentMilestone.create({
      data: {
        shipmentId: shipment.id,
        code: "ASN_VALIDATED",
        source: "INTERNAL",
        actualAt: new Date(),
        updatedById: actorId,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
