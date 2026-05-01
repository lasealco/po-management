import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { buildOutboundDesadvSnapshotV1 } from "@/lib/wms/outbound-desadv-export";
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
    return toApiErrorResponse({ error: "outboundOrderId query parameter required.", code: "BAD_REQUEST", status: 400 });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const order = await prisma.outboundOrder.findFirst({
    where: mergeOutboundWhere(
      { id: outboundOrderId, tenantId: tenant.id },
      viewScope.outboundOrder,
    ),
    include: {
      warehouse: {
        select: {
          code: true,
          name: true,
          addressLine1: true,
          city: true,
          region: true,
          countryCode: true,
        },
      },
      crmAccount: { select: { id: true, name: true, legalName: true } },
      sourceCrmQuote: { select: { quoteNumber: true, title: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          lineNo: true,
          quantity: true,
          packedQty: true,
          shippedQty: true,
          product: {
            select: { id: true, sku: true, productCode: true, name: true },
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
      error: "ASN / DESADV export is available when the outbound is PACKED or SHIPPED.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  if (order.lines.length === 0) {
    return toApiErrorResponse({
      error: "Outbound has no lines to export.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  const tenantRow = await prisma.tenant.findFirst({
    where: { id: tenant.id },
    select: {
      name: true,
      legalName: true,
      addressLine1: true,
      addressCity: true,
      addressRegion: true,
      addressPostalCode: true,
      addressCountryCode: true,
    },
  });
  if (!tenantRow) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const generatedAt = new Date();
  const snapshot = buildOutboundDesadvSnapshotV1(order, tenantRow, generatedAt);

  const pretty = new URL(request.url).searchParams.get("pretty") === "1";
  const body = `${pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot)}\n`;
  const safeName = order.outboundNo.replace(/[^\w.-]+/g, "_") || "outbound";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-desadv-asn.json"`,
      "Cache-Control": "no-store",
    },
  });
}
