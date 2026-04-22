import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { listReportDefinitions, toReportListItem } from "@/lib/reports/registry";
import { canUserRunReport } from "@/lib/reports/run-report";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


export async function GET() {
  const gate = await requireApiGrant("org.reports", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const reports: ReturnType<typeof toReportListItem>[] = [];
  for (const def of listReportDefinitions()) {
    const ok = await canUserRunReport(actorId, def.id);
    if (ok.ok) reports.push(toReportListItem(def));
  }

  return NextResponse.json({ reports });
}
