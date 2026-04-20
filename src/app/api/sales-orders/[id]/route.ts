import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  canTransitionSalesOrderStatus,
  parseSalesOrderPatchPayload,
  type SalesOrderStatus,
} from "@/lib/sales-orders";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const { id } = await context.params;

  if (!id) return NextResponse.json({ error: "Sales order id is required." }, { status: 400 });

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
  }).catch(() => undefined);
  if (row === undefined) {
    return NextResponse.json({ error: "Could not load sales order." }, { status: 500 });
  }
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
  if (!id) return NextResponse.json({ error: "Sales order id is required." }, { status: 400 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = parseSalesOrderPatchPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const row = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      status: true,
      shipments: { select: { id: true, status: true, shipmentNo: true } },
    },
  }).catch(() => undefined);
  if (row === undefined) {
    return NextResponse.json({ error: "Could not load sales order." }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });

  const targetStatus = parsed.status;
  const transition = canTransitionSalesOrderStatus(row.status as SalesOrderStatus, targetStatus);
  if (!transition.ok) {
    return NextResponse.json({ error: transition.error }, { status: 409 });
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
    data: { status: targetStatus },
    select: { id: true, status: true },
  }).catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "Could not update sales order status." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
