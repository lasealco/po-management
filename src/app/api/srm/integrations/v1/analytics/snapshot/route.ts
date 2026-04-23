import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { parseSrmAnalyticsQuery } from "@/lib/srm/srm-analytics-request";
import {
  loadSrmBookingSlaStats,
  loadSrmOperationalSignals,
  loadSrmOrderVolumeKpis,
} from "@/lib/srm/srm-analytics-aggregates";

/**
 * Outbound: same analytics payload as `GET /api/srm/analytics` with a version stamp for ERP/BI consumers.
 * See `docs/srm/INTEGRATION.md` § Analytics snapshot.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const url = new URL(request.url);
  const parsed = parseSrmAnalyticsQuery(url);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "BAD_INPUT", status: 400 });
  }
  const { from: fromStart, to: toEnd, kind } = parsed;

  const orderGate = await requireApiGrant("org.orders", "view");
  const [orderKpi, bookingSla, operationalSignals] = await Promise.all([
    !orderGate
      ? loadSrmOrderVolumeKpis(prisma, tenant.id, { from: fromStart, to: toEnd, srmKind: kind })
      : Promise.resolve(null),
    kind === "logistics"
      ? loadSrmBookingSlaStats(prisma, tenant.id, { from: fromStart, to: toEnd })
      : Promise.resolve(null),
    loadSrmOperationalSignals(prisma, tenant.id, { srmKind: kind }),
  ]);

  return NextResponse.json({
    schemaVersion: 1,
    kind: "srm_analytics_snapshot_v1",
    generatedAt: new Date().toISOString(),
    from: fromStart.toISOString(),
    to: toEnd.toISOString(),
    supplierKind: kind,
    orderKpi,
    orderMetricsRequiresOrdersView: orderGate != null,
    bookingSla,
    operationalSignals,
  });
}
