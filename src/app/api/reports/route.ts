import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { listReportDefinitions, toReportListItem } from "@/lib/reports/registry";
import { canUserRunReport } from "@/lib/reports/run-report";

export async function GET() {
  const gate = await requireApiGrant("org.reports", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const reports: ReturnType<typeof toReportListItem>[] = [];
  for (const def of listReportDefinitions()) {
    const ok = await canUserRunReport(actorId, def.id);
    if (ok.ok) reports.push(toReportListItem(def));
  }

  return NextResponse.json({ reports });
}
