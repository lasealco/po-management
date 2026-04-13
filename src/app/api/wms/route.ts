import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getWmsDashboardPayload } from "@/lib/wms/get-wms-payload";
import { parseMovementLedgerQuery } from "@/lib/wms/movement-ledger-query";
import { handleWmsPost } from "@/lib/wms/post-actions";
import type { WmsBody } from "@/lib/wms/wms-body";

async function getTenant() {
  const tenant = await getDemoTenant();
  if (!tenant) return null;
  return tenant;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active actor." }, { status: 403 });
  const movementLedger = parseMovementLedgerQuery(new URL(request.url).searchParams);
  const payload = await getWmsDashboardPayload(tenant.id, actorId, movementLedger ?? null);
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.wms", "edit");
  if (gate) return gate;
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active actor." }, { status: 403 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as WmsBody;
  return handleWmsPost(tenant.id, actorId, input);
}
