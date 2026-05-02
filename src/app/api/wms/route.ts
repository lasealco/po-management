import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getWmsDashboardPayload } from "@/lib/wms/get-wms-payload";
import { fetchWmsHomeKpis } from "@/lib/wms/wms-home-kpis";
import { parseMovementLedgerQuery } from "@/lib/wms/movement-ledger-query";
import { handleWmsPost } from "@/lib/wms/post-actions";
import { fetchWarehouseTopologyGraph } from "@/lib/wms/warehouse-topology-graph";
import { gateWmsPostMutation } from "@/lib/wms/wms-mutation-grants";
import type { WmsBody } from "@/lib/wms/wms-body";

export const dynamic = "force-dynamic";

async function getTenant() {
  const tenant = await getDemoTenant();
  if (!tenant) return null;
  return tenant;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;
  const tenant = await getTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  const url = new URL(request.url);
  if (url.searchParams.get("homeKpis") === "1") {
    const wh = url.searchParams.get("warehouseId") ?? url.searchParams.get("wh");
    const kpis = await fetchWmsHomeKpis(tenant.id, { warehouseId: wh || undefined });
    return NextResponse.json(kpis);
  }
  if (url.searchParams.get("topologyGraph") === "1") {
    const wid = (url.searchParams.get("warehouseId") ?? url.searchParams.get("wh") ?? "").trim();
    if (!wid) {
      return toApiErrorResponse({
        error: "warehouseId (or wh) query parameter required.",
        code: "VALIDATION_ERROR",
        status: 400,
      });
    }
    const graph = await fetchWarehouseTopologyGraph({ tenantId: tenant.id, warehouseId: wid });
    if (!graph) {
      return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });
    }
    return NextResponse.json(graph);
  }
  const movementLedger = parseMovementLedgerQuery(url.searchParams);
  const tracePid = url.searchParams.get("traceProductId")?.trim();
  const traceSn = url.searchParams.get("traceSerialNo")?.trim();
  const serialTrace =
    tracePid && traceSn ? { productId: tracePid, serialNoRaw: traceSn } : null;
  const payload = await getWmsDashboardPayload(tenant.id, actorId, movementLedger ?? null, serialTrace);
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const gateView = await requireApiGrant("org.wms", "view");
  if (gateView) return gateView;
  const tenant = await getTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as WmsBody;
  const gateMut = await gateWmsPostMutation(actorId, input.action);
  if (gateMut) return gateMut;
  return handleWmsPost(tenant.id, actorId, input);
}
