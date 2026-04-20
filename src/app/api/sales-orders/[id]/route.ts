import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  evaluateSalesOrderStatusTransition,
  parseSalesOrderPatchRequestBody,
  parseSalesOrderRouteId,
  parseTargetSalesOrderStatus,
} from "@/lib/sales-orders/patch-status";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const { id: rawId } = await context.params;
  const idParsed = parseSalesOrderRouteId(rawId);
  if (!idParsed.ok) {
    return NextResponse.json({ error: idParsed.error }, { status: idParsed.status });
  }
  const { id } = idParsed;

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const { id: rawId } = await context.params;
  const idParsed = parseSalesOrderRouteId(rawId);
  if (!idParsed.ok) {
    return NextResponse.json({ error: idParsed.error }, { status: idParsed.status });
  }
  const { id } = idParsed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsedBody = parseSalesOrderPatchRequestBody(body);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const parsedStatus = parseTargetSalesOrderStatus(parsedBody.record);
  if (!parsedStatus.ok) {
    return NextResponse.json({ error: parsedStatus.error }, { status: 400 });
  }
  const targetStatus = parsedStatus.status;

  const row = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      status: true,
      shipments: { select: { id: true, status: true, shipmentNo: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });

  const transition = evaluateSalesOrderStatusTransition({
    current: row.status,
    target: targetStatus,
    shipments: row.shipments,
  });
  if (!transition.ok) {
    const payload: { error: string; activeShipments?: typeof transition.activeShipments } = {
      error: transition.error,
    };
    if (transition.activeShipments) {
      payload.activeShipments = transition.activeShipments;
    }
    return NextResponse.json(payload, { status: transition.status });
  }

  const updated = await prisma.salesOrder.update({
    where: { id: row.id },
    data: { status: targetStatus },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
