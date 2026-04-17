import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type ShipmentLineInput = {
  orderItemId: string;
  quantityShipped: string;
  plannedShipDate?: string | null;
};

type CreateShipmentBody = {
  shipmentNo?: string | null;
  shippedAt?: string | null;
  trackingNo?: string | null;
  transportMode?: "OCEAN" | "AIR" | "ROAD" | "RAIL" | null;
  estimatedVolumeCbm?: string | null;
  estimatedWeightKg?: string | null;
  notes?: string | null;
  lines: ShipmentLineInput[];
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active demo actor." }, { status: 403 });
  }
  const isSupplier = await userHasRoleNamed(actorId, "Supplier portal");
  if (!isSupplier) {
    return NextResponse.json(
      { error: "Only supplier users can create ASN shipments." },
      { status: 403 },
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const { id: orderId } = await context.params;
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, tenantId: tenant.id },
    include: {
      workflow: { select: { supplierPortalOn: true } },
      items: { select: { id: true, quantity: true, lineNo: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (!order.workflow.supplierPortalOn) {
    return NextResponse.json(
      { error: "ASN is only supported for supplier-portal workflows." },
      { status: 403 },
    );
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
  const input = body as CreateShipmentBody;
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return NextResponse.json(
      { error: "lines[] is required for ASN." },
      { status: 400 },
    );
  }

  const itemById = new Map(order.items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (!itemById.has(line.orderItemId)) {
      return NextResponse.json(
        { error: `Unknown orderItemId: ${line.orderItemId}` },
        { status: 400 },
      );
    }
    if (seen.has(line.orderItemId)) {
      return NextResponse.json(
        { error: `Duplicate orderItemId: ${line.orderItemId}` },
        { status: 400 },
      );
    }
    seen.add(line.orderItemId);
    const qty = Number(line.quantityShipped);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "quantityShipped must be a positive number." },
        { status: 400 },
      );
    }
  }

  const shippedAt =
    input.shippedAt && input.shippedAt.trim()
      ? new Date(`${input.shippedAt.trim()}T12:00:00.000Z`)
      : new Date();
  if (Number.isNaN(shippedAt.getTime())) {
    return NextResponse.json({ error: "Invalid shippedAt date." }, { status: 400 });
  }
  const volume =
    input.estimatedVolumeCbm && input.estimatedVolumeCbm.trim()
      ? Number(input.estimatedVolumeCbm)
      : null;
  const weight =
    input.estimatedWeightKg && input.estimatedWeightKg.trim()
      ? Number(input.estimatedWeightKg)
      : null;
  if (volume != null && (!Number.isFinite(volume) || volume <= 0)) {
    return NextResponse.json(
      { error: "estimatedVolumeCbm must be a positive number." },
      { status: 400 },
    );
  }
  if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
    return NextResponse.json(
      { error: "estimatedWeightKg must be a positive number." },
      { status: 400 },
    );
  }

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId: order.id,
        shipmentNo: input.shipmentNo?.trim() || null,
        shippedAt,
        trackingNo: input.trackingNo?.trim() || null,
        transportMode: input.transportMode ?? null,
        estimatedVolumeCbm: volume != null ? volume.toString() : null,
        estimatedWeightKg: weight != null ? weight.toString() : null,
        notes: input.notes?.trim() || null,
        createdById: actorId,
        items: {
          create: input.lines.map((line) => ({
            orderItemId: line.orderItemId,
            quantityShipped: line.quantityShipped,
            plannedShipDate:
              line.plannedShipDate && line.plannedShipDate.trim()
                ? new Date(`${line.plannedShipDate.trim()}T12:00:00.000Z`)
                : null,
          })),
        },
      },
      select: { id: true },
    });
    await tx.shipmentMilestone.create({
      data: {
        shipmentId: created.id,
        code: "ASN_SUBMITTED",
        source: "SUPPLIER",
        actualAt: new Date(),
        updatedById: actorId,
      },
    });
    return created;
  });

  return NextResponse.json({ ok: true, shipmentId: shipment.id });
}
