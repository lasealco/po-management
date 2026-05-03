import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  buildCarrierClaimExportV1,
  type DamageClaimOutboundSummary,
  type DamageClaimShipmentSummary,
} from "@/lib/wms/damage-report-bf65";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const dynamic = "force-dynamic";

function mergeShipmentWhere(
  base: Prisma.ShipmentWhereInput,
  scope: Prisma.ShipmentWhereInput,
): Prisma.ShipmentWhereInput {
  if (!scope || Object.keys(scope).length === 0) return base;
  return { AND: [base, scope] };
}

function mergeOutboundWhere(
  base: Prisma.OutboundOrderWhereInput,
  scope: Prisma.OutboundOrderWhereInput,
): Prisma.OutboundOrderWhereInput {
  if (!scope || Object.keys(scope).length === 0) return base;
  return { AND: [base, scope] };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  }

  const { id } = await ctx.params;
  const reportId = id?.trim();
  if (!reportId) {
    return toApiErrorResponse({ error: "Missing damage report id.", code: "BAD_REQUEST", status: 400 });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);

  const report = await prisma.wmsDamageReport.findFirst({
    where: { id: reportId, tenantId: tenant.id },
    select: {
      id: true,
      context: true,
      status: true,
      damageCategory: true,
      description: true,
      photoUrlsJson: true,
      extraDetailJson: true,
      carrierClaimReference: true,
      shipmentItemId: true,
      createdAt: true,
      shipmentId: true,
      outboundOrderId: true,
    },
  });

  if (!report) {
    return toApiErrorResponse({ error: "Damage report not found.", code: "NOT_FOUND", status: 404 });
  }

  if (report.shipmentId) {
    const okShip = await prisma.shipment.findFirst({
      where: mergeShipmentWhere(
        { id: report.shipmentId, order: { tenantId: tenant.id } },
        viewScope.shipment,
      ),
      select: { id: true },
    });
    if (!okShip) {
      return toApiErrorResponse({ error: "Damage report not found.", code: "NOT_FOUND", status: 404 });
    }
  }

  if (report.outboundOrderId) {
    const okOb = await prisma.outboundOrder.findFirst({
      where: mergeOutboundWhere(
        { id: report.outboundOrderId, tenantId: tenant.id },
        viewScope.outboundOrder,
      ),
      select: { id: true },
    });
    if (!okOb) {
      return toApiErrorResponse({ error: "Damage report not found.", code: "NOT_FOUND", status: 404 });
    }
  }

  let inboundShipment: DamageClaimShipmentSummary | null = null;
  if (report.shipmentId) {
    const ship = await prisma.shipment.findFirst({
      where: { id: report.shipmentId, order: { tenantId: tenant.id } },
      select: {
        id: true,
        shipmentNo: true,
        asnReference: true,
        carrier: true,
        trackingNo: true,
        order: { select: { id: true, orderNumber: true } },
        _count: { select: { items: true } },
      },
    });
    if (ship) {
      inboundShipment = {
        id: ship.id,
        shipmentNo: ship.shipmentNo,
        asnReference: ship.asnReference,
        carrier: ship.carrier,
        trackingNo: ship.trackingNo,
        purchaseOrder: ship.order
          ? { id: ship.order.id, orderNumber: ship.order.orderNumber }
          : null,
        lineCount: ship._count.items,
      };
    }
  }

  let outboundOrder: DamageClaimOutboundSummary | null = null;
  if (report.outboundOrderId) {
    const ob = await prisma.outboundOrder.findFirst({
      where: { id: report.outboundOrderId, tenantId: tenant.id },
      select: {
        id: true,
        outboundNo: true,
        asnReference: true,
        status: true,
        carrierTrackingNo: true,
        shipToName: true,
        shipToCity: true,
        shipToCountryCode: true,
        warehouse: { select: { code: true, name: true } },
        _count: { select: { lines: true } },
      },
    });
    if (ob) {
      outboundOrder = {
        id: ob.id,
        outboundNo: ob.outboundNo,
        asnReference: ob.asnReference,
        status: ob.status,
        carrierTrackingNo: ob.carrierTrackingNo,
        shipToName: ob.shipToName,
        shipToCity: ob.shipToCity,
        shipToCountryCode: ob.shipToCountryCode,
        warehouse: ob.warehouse,
        lineCount: ob._count.lines,
      };
    }
  }

  const photoUrls = Array.isArray(report.photoUrlsJson)
    ? report.photoUrlsJson.filter((u): u is string => typeof u === "string")
    : [];

  const payload = buildCarrierClaimExportV1({
    generatedAt: new Date(),
    report: {
      id: report.id,
      context: report.context,
      status: report.status,
      damageCategory: report.damageCategory,
      description: report.description,
      photoUrls,
      extraDetail: report.extraDetailJson ?? null,
      carrierClaimReference: report.carrierClaimReference,
      shipmentItemId: report.shipmentItemId,
      createdAt: report.createdAt,
    },
    inboundShipment,
    outboundOrder,
  });

  return NextResponse.json(payload);
}
