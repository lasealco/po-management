import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type ReceiveLineInput = { shipmentItemId: string; quantityReceived: string };
type ReceiveBody = { lines?: ReceiveLineInput[] };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }
  const isSupplier = await userHasRoleNamed(actorId, "Supplier portal");
  if (isSupplier) {
    return NextResponse.json(
      { error: "Supplier users cannot mark buyer receipts." },
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
    include: { items: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as ReceiveBody;
  const lineMap = new Map<string, number>();
  for (const row of input.lines ?? []) {
    const qty = Number(row.quantityReceived);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "quantityReceived must be positive." },
        { status: 400 },
      );
    }
    lineMap.set(row.shipmentItemId, qty);
  }
  const hasExplicitLines = lineMap.size > 0;

  await prisma.$transaction(async (tx) => {
    for (const item of shipment.items) {
      const remaining = Number(item.quantityShipped) - Number(item.quantityReceived);
      if (remaining <= 0) continue;
      const delta = hasExplicitLines
        ? (lineMap.get(item.id) ?? 0)
        : remaining;
      const capped = Math.min(remaining, delta);
      if (capped <= 0) continue;
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: {
          quantityReceived: (Number(item.quantityReceived) + capped).toString(),
        },
      });
    }

    const latest = await tx.shipmentItem.findMany({
      where: { shipmentId: shipment.id },
      select: { quantityShipped: true, quantityReceived: true },
    });
    const fullyReceived = latest.every(
      (row) => Number(row.quantityReceived) >= Number(row.quantityShipped),
    );
    if (fullyReceived) {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
