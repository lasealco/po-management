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
import { loadSerializedCompanyLegalForServedOrg } from "@/lib/sales-order-company-legal";
import { resolveServedOrgUnitIdForTenant } from "@/lib/served-org-unit";

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
      servedOrgUnit: { select: { id: true, name: true, code: true, kind: true } },
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

  const companyLegalEntity = await loadSerializedCompanyLegalForServedOrg(tenant.id, row.servedOrgUnitId);

  return NextResponse.json({
    ...row,
    companyLegalEntity,
    servedOrgUnit: row.servedOrgUnit
      ? {
          id: row.servedOrgUnit.id,
          name: row.servedOrgUnit.name,
          code: row.servedOrgUnit.code,
          kind: row.servedOrgUnit.kind,
        }
      : null,
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
  const record = parsedBody.record;
  const hasStatus = Object.prototype.hasOwnProperty.call(record, "status");
  const hasServed = Object.prototype.hasOwnProperty.call(record, "servedOrgUnitId");

  if (hasServed && !hasStatus) {
    const editGate = await requireApiGrant("org.orders", "edit");
    if (editGate) return editGate;
    const servedResolved = await resolveServedOrgUnitIdForTenant(tenant.id, record.servedOrgUnitId);
    if (!servedResolved.ok) {
      return toApiErrorResponse({ error: servedResolved.error, code: "BAD_INPUT", status: 400 });
    }
    const existing = await prisma.salesOrder.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) {
      return toApiErrorResponse({ error: "Sales order not found.", code: "NOT_FOUND", status: 404 });
    }
    const headerUpdated = await prisma.salesOrder.update({
      where: { id: existing.id },
      data: {
        servedOrgUnit: servedResolved.value
          ? { connect: { id: servedResolved.value } }
          : { disconnect: true },
      },
      select: {
        id: true,
        servedOrgUnitId: true,
        servedOrgUnit: { select: { id: true, name: true, code: true, kind: true } },
      },
    });
    const companyLegalEntity = await loadSerializedCompanyLegalForServedOrg(
      tenant.id,
      headerUpdated.servedOrgUnitId,
    );
    return NextResponse.json({
      ok: true,
      id: headerUpdated.id,
      companyLegalEntity,
      servedOrgUnit: headerUpdated.servedOrgUnit
        ? {
            id: headerUpdated.servedOrgUnit.id,
            name: headerUpdated.servedOrgUnit.name,
            code: headerUpdated.servedOrgUnit.code,
            kind: headerUpdated.servedOrgUnit.kind,
          }
        : null,
    });
  }

  if (hasServed && hasStatus) {
    return toApiErrorResponse({
      error: "Send `status` and `servedOrgUnitId` in separate requests.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  if (!hasStatus) {
    return toApiErrorResponse({
      error: "Field `status` is required, or use `servedOrgUnitId` alone to update order-for org.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const parsedStatus = parseTargetSalesOrderStatus(record);
  if (!parsedStatus.ok) {
    return toApiErrorResponse({ error: parsedStatus.error, code: "BAD_INPUT", status: 400 });
  }
  const targetStatus = parsedStatus.status;

  const transitionGate = await requireApiGrant("org.orders", "transition");
  if (transitionGate) return transitionGate;

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
