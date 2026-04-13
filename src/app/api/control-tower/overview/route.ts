import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getControlTowerOverview } from "@/lib/control-tower/overview";
import { isControlTowerCustomerView } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  const isCustomer =
    actorId !== null ? await isControlTowerCustomerView(actorId) : false;

  const overview = await getControlTowerOverview({
    tenantId: tenant.id,
    isCustomer,
  });
  return NextResponse.json(overview);
}
