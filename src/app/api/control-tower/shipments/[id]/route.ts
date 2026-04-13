import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getShipment360 } from "@/lib/control-tower/shipment-360";
import { isControlTowerCustomerView } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  const isCustomer =
    actorId !== null ? await isControlTowerCustomerView(actorId) : false;

  const { id } = await context.params;
  const data = await getShipment360({
    tenantId: tenant.id,
    shipmentId: id,
    isCustomer,
  });
  if (!data) {
    return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}
