import { NextResponse } from "next/server";

import { errorCodeForHttpStatus, toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
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
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id: rawId } = await context.params;
  const idParsed = parseSalesOrderRouteId(rawId);
  if (!idParsed.ok) {
    return toApiErrorResponse({
      error: idParsed.error,
      code: errorCodeForHttpStatus(idParsed.status),
      status: idParsed.status,
    });
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
  if (!row) return toApiErrorResponse({ error: "Sales order not found.", code: "NOT_FOUND", status: 404 });

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
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id: rawId } = await context.params;
  const idParsed = parseSalesOrderRouteId(rawId);
  if (!idParsed.ok) {
    return toApiErrorResponse({
      error: idParsed.error,
      code: errorCodeForHttpStatus(idParsed.status),
      status: idParsed.status,
    });
  }
  const { id } = idParsed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }

  const parsedBody = parseSalesOrderPatchRequestBody(body);
  if (!parsedBody.ok) {
    return toApiErrorResponse({
      error: parsedBody.error,
      code: errorCodeForHttpStatus(parsedBody.status),
      status: parsedBody.status,
    });
  }

  const parsedStatus = parseTargetSalesOrderStatus(parsedBody.record);
  if (!parsedStatus.ok) {
    return toApiErrorResponse({ error: parsedStatus.error, code: "BAD_INPUT", status: 400 });
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
  if (!row) return toApiErrorResponse({ error: "Sales order not found.", code: "NOT_FOUND", status: 404 });

  const transition = evaluateSalesOrderStatusTransition({
    current: row.status,
    target: targetStatus,
    shipments: row.shipments,
  });
  if (!transition.ok) {
    const payload: {
      code: typeof transition.code;
      error: string;
      activeShipments?: typeof transition.activeShipments;
    } = {
      code: transition.code,
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
