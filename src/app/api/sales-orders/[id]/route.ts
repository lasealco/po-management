import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const { id } = await context.params;

  const row = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      shipments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shipmentNo: true,
          status: true,
          transportMode: true,
          carrier: true,
          trackingNo: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });

  return NextResponse.json({
    ...row,
    requestedShipDate: row.requestedShipDate?.toISOString() ?? null,
    requestedDeliveryDate: row.requestedDeliveryDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    shipments: row.shipments.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  });
}

const ACTIVE_SHIPMENT_STATUSES = new Set(["SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const { id } = await context.params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const targetStatus = typeof o.status === "string" ? o.status.trim().toUpperCase() : "";
  if (!["DRAFT", "OPEN", "CLOSED"].includes(targetStatus)) {
    return NextResponse.json({ error: "status must be DRAFT | OPEN | CLOSED" }, { status: 400 });
  }

  const row = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      status: true,
      shipments: { select: { id: true, status: true, shipmentNo: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });

  const current = row.status;
  const allowed: Record<string, string[]> = {
    DRAFT: ["OPEN", "CLOSED"],
    OPEN: ["DRAFT", "CLOSED"],
    CLOSED: ["OPEN"],
  };
  if (!allowed[current]?.includes(targetStatus)) {
    return NextResponse.json(
      { error: `Cannot change status from ${current} to ${targetStatus}.` },
      { status: 409 },
    );
  }

  if (targetStatus === "CLOSED") {
    const active = row.shipments.filter((s) => ACTIVE_SHIPMENT_STATUSES.has(s.status));
    if (active.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot close sales order while linked shipments are active.",
          activeShipments: active.map((s) => ({
            id: s.id,
            shipmentNo: s.shipmentNo,
            status: s.status,
          })),
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.salesOrder.update({
    where: { id: row.id },
    data: { status: targetStatus as "DRAFT" | "OPEN" | "CLOSED" },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
