import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { prisma } from "@/lib/prisma";
import { authenticatePartnerApiRequest, partnerHasScope } from "@/lib/wms/partner-api-auth";
import { partnerV1Json } from "@/lib/wms/partner-v1-response";

export const dynamic = "force-dynamic";

const PRODUCT_FIELDS = {
  id: true,
  sku: true,
  productCode: true,
  name: true,
} as const;

export async function GET(request: Request) {
  const auth = await authenticatePartnerApiRequest(request);
  if (!auth) {
    return toApiErrorResponse({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 });
  }
  if (!partnerHasScope(auth, "INVENTORY_READ")) {
    return toApiErrorResponse({
      error: "Missing INVENTORY_READ scope.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouseId")?.trim();
  if (!warehouseId) {
    return toApiErrorResponse({
      error: "warehouseId query parameter is required.",
      code: "BAD_REQUEST",
      status: 400,
    });
  }

  const limitRaw = Number(url.searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(2000, Math.max(1, Math.floor(limitRaw)))
    : 500;

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId: auth.tenantId },
    select: { id: true, code: true, name: true },
  });
  if (!warehouse) {
    return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });
  }

  const rows = await prisma.inventoryBalance.findMany({
    where: { tenantId: auth.tenantId, warehouseId },
    take: limit,
    orderBy: [{ bin: { code: "asc" } }, { product: { sku: "asc" } }],
    select: {
      id: true,
      lotCode: true,
      onHandQty: true,
      allocatedQty: true,
      onHold: true,
      holdReason: true,
      bin: { select: { id: true, code: true, name: true } },
      product: { select: PRODUCT_FIELDS },
    },
  });

  return partnerV1Json({
    schemaVersion: 1,
    tenantSlug: auth.tenantSlug,
    warehouse,
    balances: rows.map((r) => ({
      id: r.id,
      lotCode: r.lotCode,
      onHandQty: r.onHandQty.toFixed(3),
      allocatedQty: r.allocatedQty.toFixed(3),
      onHold: r.onHold,
      holdReason: r.holdReason,
      bin: r.bin,
      product: r.product,
    })),
  });
}
