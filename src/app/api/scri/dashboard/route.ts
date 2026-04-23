import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getScriDashboardStats } from "@/lib/scri/dashboard-aggregates";
import { getScriTuningForTenant } from "@/lib/scri/tuning-repo";
import { listWatchlistRulesForTenant } from "@/lib/scri/watchlist-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.scri", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { dto: tuning } = await getScriTuningForTenant(tenant.id);
  const rules = await listWatchlistRulesForTenant(tenant.id);
  const stats = await getScriDashboardStats(tenant.id, tuning, rules);

  return NextResponse.json({ stats, tuning, activeWatchlistRules: rules.filter((r) => r.isActive).length });
}
