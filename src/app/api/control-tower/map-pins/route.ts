import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { buildControlTowerMapPins } from "@/lib/control-tower/map-pins";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
import { parseControlTowerShipmentsListQuery } from "@/lib/control-tower/shipments-list-query-from-search-params";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/**
 * `searchParams` match `GET /api/control-tower/shipments` (workbench / map share semantics).
 * Pins use booking + leg **origin/destination** codes against `product-trace-geo` (demo LOCODES).
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
    query: parsed.query,
  });

  const { pins, unmappedCount } = buildControlTowerMapPins(listResult.rows);

  return NextResponse.json({
    q: parsed.qEcho,
    productTrace: parsed.productTrace ?? null,
    pins,
    unmappedCount,
    listLimit: listResult.listLimit,
    itemCount: listResult.rows.length,
    truncated: listResult.truncated,
  });
}
