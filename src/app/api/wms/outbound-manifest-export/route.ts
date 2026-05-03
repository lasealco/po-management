import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  buildOutboundManifestExportV1,
  manifestParcelIdsFromDbJson,
} from "@/lib/wms/outbound-manifest-bf67";
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
      customerRef: true,
      asnReference: true,
      shipToName: true,
      shipToLine1: true,
      shipToCity: true,
      shipToCountryCode: true,
      carrierTrackingNo: true,
      carrierLabelAdapterId: true,
      carrierLabelPurchasedAt: true,
      manifestParcelIds: true,
      warehouse: { select: { code: true, name: true } },
      logisticsUnits: {
        orderBy: { scanCode: "asc" },
        select: {
          id: true,
          scanCode: true,
          kind: true,
          parentUnitId: true,
          outboundOrderLineId: true,
        },
      },
    },
  });

  if (!order) {
    return toApiErrorResponse({ error: "Outbound order not found.", code: "NOT_FOUND", status: 404 });
  }

  if (order.status !== "PACKED" && order.status !== "SHIPPED") {
    return toApiErrorResponse({
      error: "Manifest export is available when the outbound is PACKED or SHIPPED.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  const manifest = manifestParcelIdsFromDbJson(order.manifestParcelIds);
  const primary = order.carrierTrackingNo?.trim() || null;
  if (manifest.length === 0 && !primary) {
    return toApiErrorResponse({
      error: "Set manifest parcel ids or purchase a carrier label before exporting.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  const generatedAt = new Date();
  const snapshot = buildOutboundManifestExportV1(order, generatedAt);

  const pretty = new URL(request.url).searchParams.get("pretty") === "1";
  const body = `${pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot)}\n`;
  const safeName = order.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-outbound-manifest-bf67.json"`,
      "Cache-Control": "no-store",
    },
  });
}
