import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getWmsDashboardPayload } from "@/lib/wms/get-wms-payload";
import { fetchWmsHomeKpis } from "@/lib/wms/wms-home-kpis";
import { parseMovementLedgerQuery } from "@/lib/wms/movement-ledger-query";
import { handleWmsPost } from "@/lib/wms/post-actions";
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
  const movementLedger = parseMovementLedgerQuery(url.searchParams);
  const payload = await getWmsDashboardPayload(tenant.id, actorId, movementLedger ?? null);
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
