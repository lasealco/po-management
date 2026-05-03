import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { prisma } from "@/lib/prisma";
import { authenticatePartnerApiRequest, partnerHasScope } from "@/lib/wms/partner-api-auth";
import { manifestParcelIdsFromDbJson } from "@/lib/wms/outbound-manifest-bf67";
import { partnerV1Json } from "@/lib/wms/partner-v1-response";

export const dynamic = "force-dynamic";

const PRODUCT_FIELDS = {
  id: true,
  sku: true,
  productCode: true,
  name: true,
} as const;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ outboundOrderId: string }> },
) {
  const auth = await authenticatePartnerApiRequest(request);
  if (!auth) {
    return toApiErrorResponse({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 });
  }
  if (!partnerHasScope(auth, "OUTBOUND_READ")) {
    return toApiErrorResponse({
      error: "Missing OUTBOUND_READ scope.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const { outboundOrderId } = await ctx.params;
  const oid = outboundOrderId?.trim();
  if (!oid) {
    return toApiErrorResponse({ error: "outboundOrderId required.", code: "BAD_REQUEST", status: 400 });
  }

  const order = await prisma.outboundOrder.findFirst({
    where: { id: oid, tenantId: auth.tenantId },
    select: {
      id: true,
      outboundNo: true,
      customerRef: true,
      asnReference: true,
      status: true,
      requestedShipDate: true,
      shipToName: true,
      shipToCity: true,
      shipToCountryCode: true,
      carrierTrackingNo: true,
      manifestParcelIds: true,
      warehouse: { select: { id: true, code: true, name: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          quantity: true,
          pickedQty: true,
          packedQty: true,
          shippedQty: true,
          product: { select: PRODUCT_FIELDS },
        },
      },
    },
  });

  if (!order) {
    return toApiErrorResponse({ error: "Outbound order not found.", code: "NOT_FOUND", status: 404 });
  }

  return partnerV1Json({
    schemaVersion: 1,
    tenantSlug: auth.tenantSlug,
    order: {
      ...order,
      manifestParcelIds: manifestParcelIdsFromDbJson(order.manifestParcelIds),
      requestedShipDate: order.requestedShipDate?.toISOString() ?? null,
      lines: order.lines.map((ln) => ({
        id: ln.id,
        lineNo: ln.lineNo,
        quantity: ln.quantity.toFixed(3),
        pickedQty: ln.pickedQty.toFixed(3),
        packedQty: ln.packedQty.toFixed(3),
        shippedQty: ln.shippedQty.toFixed(3),
        product: ln.product,
      })),
    },
  });
}
