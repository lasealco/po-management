import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { listControlTowerShipments } from "@/lib/control-tower/list-shipments";
import { isControlTowerCustomerView } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  const isCustomer =
    actorId !== null ? await isControlTowerCustomerView(actorId) : false;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ shipments: [], message: "Provide q= search text." });
  }

  const rows = await listControlTowerShipments({
    tenantId: tenant.id,
    isCustomer,
    query: { q, take: 40 },
  });

  return NextResponse.json({ q, shipments: rows });
}
