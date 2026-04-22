import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildReportingCockpitSnapshot } from "@/lib/reporting/cockpit-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  if (!access?.user) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  const canSeeAny =
    viewerHas(access.grantSet, "org.reports", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.crm", "view") ||
    viewerHas(access.grantSet, "org.wms", "view");
  if (!canSeeAny) {
    return toApiErrorResponse({ error: "Forbidden: no reporting module grants.", code: "FORBIDDEN", status: 403 });
  }

  const actorId = await getActorUserId();
  const snapshot = await buildReportingCockpitSnapshot({
    tenantId: tenant.id,
    actorUserId: actorId,
  });
  return NextResponse.json({ snapshot });
}
