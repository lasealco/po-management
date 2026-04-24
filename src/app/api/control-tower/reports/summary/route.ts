import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


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
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const ctx = await getControlTowerPortalContext(actorId);

  const summary = await getControlTowerReportsSummary({
    tenantId: tenant.id,
    ctx,
    actorUserId: actorId,
  });
  return NextResponse.json(summary);
}
