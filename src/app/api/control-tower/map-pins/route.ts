import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { buildWarehouseMapPins } from "@/lib/control-tower/map-layers";
import { buildControlTowerMapPins } from "@/lib/control-tower/map-pins";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
import { parseControlTowerShipmentsListQuery } from "@/lib/control-tower/shipments-list-query-from-search-params";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * `searchParams` match `GET /api/control-tower/shipments` (workbench / map share semantics).
 * Shipment pins use booking + leg **origin/destination** codes against `product-trace-geo` (demo LOCODES).
 * **BF-11:** with **`org.wms` → view**, active **`Warehouse`** rows append **site** pins (city/country/name heuristic — not rack geometry).
 */
export async function GET(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);

  const { searchParams } = new URL(request.url);
  const parsed = parseControlTowerShipmentsListQuery(searchParams);

  const listResult = await listControlTowerShipments({
    tenantId: tenant.id,
    ctx,
    actorUserId: actorId,
    query: parsed.query,
  });

  const { pins, unmappedCount } = buildControlTowerMapPins(listResult.rows);

  let warehousePins: ReturnType<typeof buildWarehouseMapPins> = [];
  let warehouseSiteUnmapped = 0;
  const canMapWmsSites = await userHasGlobalGrant(actorId, "org.wms", "view");
  if (canMapWmsSites) {
    const warehouses = await prisma.warehouse.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        region: true,
        countryCode: true,
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      take: 80,
    });
    warehousePins = buildWarehouseMapPins(warehouses);
    warehouseSiteUnmapped = Math.max(0, warehouses.length - warehousePins.length);
  }

  return NextResponse.json({
    q: parsed.qEcho,
    productTrace: parsed.productTrace ?? null,
    pins,
    unmappedCount,
    warehousePins,
    warehouseSiteUnmapped,
    listLimit: listResult.listLimit,
    itemCount: listResult.rows.length,
    truncated: listResult.truncated,
  });
}
