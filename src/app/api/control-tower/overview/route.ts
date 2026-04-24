import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getControlTowerOverview } from "@/lib/control-tower/overview";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/**
 * Control Tower **hub** KPIs for `/control-tower` (see `getControlTowerOverview`).
 * For the **reports workspace** aggregate (`getControlTowerReportsSummary` — route actions, owner load, ETA lane rollups),
 * use `GET /api/control-tower/reports/summary`.
 */
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

  const overview = await getControlTowerOverview({
    tenantId: tenant.id,
    ctx,
    actorUserId: actorId,
  });
  return NextResponse.json(overview);
}
