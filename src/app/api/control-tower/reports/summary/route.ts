import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getControlTowerReportsSummary } from "@/lib/control-tower/reports-summary";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/** Deep reporting KPIs for `/control-tower/reports` (see `getControlTowerReportsSummary`). Hub tiles use `GET …/overview` instead. */
export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);

  const summary = await getControlTowerReportsSummary({
    tenantId: tenant.id,
    ctx,
  });
  return NextResponse.json(summary);
}
