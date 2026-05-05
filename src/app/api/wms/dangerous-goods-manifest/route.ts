import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { buildDangerousGoodsManifestBf72 } from "@/lib/wms/dangerous-goods-bf72";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const dynamic = "force-dynamic";

function mergeOutboundWhere(
  base: Prisma.OutboundOrderWhereInput,
  scope: Prisma.OutboundOrderWhereInput,
): Prisma.OutboundOrderWhereInput {
  if (!scope || Object.keys(scope).length === 0) return base;
  return { AND: [base, scope] };
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  }

  const outboundOrderId = new URL(request.url).searchParams.get("outboundOrderId")?.trim();
  if (!outboundOrderId) {
    return toApiErrorResponse({
      error: "outboundOrderId query parameter required.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const order = await prisma.outboundOrder.findFirst({
    where: mergeOutboundWhere(
      { id: outboundOrderId, tenantId: tenant.id },
      viewScope.outboundOrder,
    ),
    select: {
      id: true,
      outboundNo: true,
      status: true,
      carrierTrackingNo: true,
      shipToName: true,
      shipToCity: true,
      shipToCountryCode: true,
      wmsDangerousGoodsChecklistJson: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          lineNo: true,
          quantity: true,
          packedQty: true,
          shippedQty: true,
          product: {
            select: {
              id: true,
              sku: true,
              productCode: true,
              name: true,
              isDangerousGoods: true,
              dangerousGoodsClass: true,
              unNumber: true,
              properShippingName: true,
              packingGroup: true,
              msdsUrl: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return toApiErrorResponse({ error: "Outbound order not found.", code: "NOT_FOUND", status: 404 });
  }

  if (order.status !== "PACKED" && order.status !== "SHIPPED") {
    return toApiErrorResponse({
      error: "Dangerous goods manifest export is available when the outbound is PACKED or SHIPPED.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  const generatedAt = new Date();
  const snapshot = buildDangerousGoodsManifestBf72({
    outboundOrderId: order.id,
    outboundNo: order.outboundNo,
    status: order.status,
    carrierTrackingNo: order.carrierTrackingNo ?? null,
    shipToName: order.shipToName ?? null,
    shipToCity: order.shipToCity ?? null,
    shipToCountryCode: order.shipToCountryCode ?? null,
    wmsDangerousGoodsChecklistJson: order.wmsDangerousGoodsChecklistJson,
    lines: order.lines.map((l) => ({
      lineNo: l.lineNo,
      quantity: l.quantity,
      packedQty: l.packedQty,
      shippedQty: l.shippedQty,
      product: {
        id: l.product.id,
        sku: l.product.sku,
        productCode: l.product.productCode,
        name: l.product.name,
        isDangerousGoods: l.product.isDangerousGoods,
        dangerousGoodsClass: l.product.dangerousGoodsClass,
        unNumber: l.product.unNumber,
        properShippingName: l.product.properShippingName,
        packingGroup: l.product.packingGroup,
        msdsUrl: l.product.msdsUrl,
      },
    })),
    generatedAt,
  });

  const pretty = new URL(request.url).searchParams.get("pretty") === "1";
  const body = `${pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot)}\n`;
  const safeName = order.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-dangerous-goods-manifest-bf72.json"`,
      "Cache-Control": "no-store",
    },
  });
}
