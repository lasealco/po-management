import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { nextSalesOrderNumber } from "@/lib/sales-orders";

export async function GET() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const rows = await prisma.salesOrder.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      soNumber: true,
      status: true,
      customerName: true,
      externalRef: true,
      requestedDeliveryDate: true,
      createdAt: true,
      _count: { select: { shipments: true } },
    },
  });

  return NextResponse.json({
    salesOrders: rows.map((r) => ({
      ...r,
      requestedDeliveryDate: r.requestedDeliveryDate?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      shipmentCount: r._count.shipments,
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const customerName = typeof o.customerName === "string" ? o.customerName.trim() : "";
  if (!customerName) {
    return NextResponse.json({ error: "customerName is required." }, { status: 400 });
  }
  const soNumberRaw = typeof o.soNumber === "string" ? o.soNumber.trim() : "";
  const soNumber = soNumberRaw || (await nextSalesOrderNumber(tenant.id));
  const externalRef = typeof o.externalRef === "string" ? o.externalRef.trim() || null : null;
  const requestedDeliveryDateRaw = typeof o.requestedDeliveryDate === "string" ? o.requestedDeliveryDate.trim() : "";
  const requestedDeliveryDate = requestedDeliveryDateRaw ? new Date(requestedDeliveryDateRaw) : null;
  if (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime())) {
    return NextResponse.json({ error: "Invalid requestedDeliveryDate." }, { status: 400 });
  }
  const shipmentId = typeof o.shipmentId === "string" ? o.shipmentId.trim() : "";

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.salesOrder.create({
      data: {
        tenantId: tenant.id,
        soNumber,
        customerName,
        externalRef,
        requestedDeliveryDate,
        createdById: actorId,
        status: "DRAFT",
      },
      select: { id: true, soNumber: true },
    });
    if (shipmentId) {
      const ship = await tx.shipment.findFirst({
        where: { id: shipmentId, order: { tenantId: tenant.id } },
        select: { id: true },
      });
      if (!ship) throw new Error("Shipment not found.");
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { salesOrderId: row.id },
      });
    }
    return row;
  });

  return NextResponse.json({ ok: true, id: created.id, soNumber: created.soNumber });
}
