import { NextResponse } from "next/server";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildReportingCockpitSnapshot } from "@/lib/reporting/cockpit-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  if (!access?.user) return NextResponse.json({ error: "No active user." }, { status: 403 });

  const canSeeAny =
    viewerHas(access.grantSet, "org.reports", "view") ||
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.crm", "view") ||
    viewerHas(access.grantSet, "org.wms", "view");
  if (!canSeeAny) {
    return NextResponse.json({ error: "Forbidden: no reporting module grants." }, { status: 403 });
  }

  const snapshot = await buildReportingCockpitSnapshot({ tenantId: tenant.id });
  return NextResponse.json({ snapshot });
}
