import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  loadSrmBookingSlaStats,
  loadSrmOrderVolumeKpis,
  type SrmKindParam,
} from "@/lib/srm/srm-analytics-aggregates";

export const runtime = "nodejs";

function parseKind(raw: string | null): SrmKindParam {
  return raw === "logistics" ? "logistics" : "product";
}

function parseIsoDate(raw: string | null, fallback: Date): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const url = new URL(request.url);
  const toDefault = new Date();
  const fromDefault = new Date(toDefault);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 90);

  const to = parseIsoDate(url.searchParams.get("to"), toDefault);
  const from = parseIsoDate(url.searchParams.get("from"), fromDefault);
  if (from.getTime() > to.getTime()) {
    return toApiErrorResponse({ error: "from must be before to.", code: "BAD_INPUT", status: 400 });
  }
  // End of `to` day UTC
  const toEnd = new Date(to);
  toEnd.setUTCHours(23, 59, 59, 999);
  const fromStart = new Date(from);
  fromStart.setUTCHours(0, 0, 0, 0);

  const kind = parseKind(url.searchParams.get("kind"));

  const orderGate = await requireApiGrant("org.orders", "view");
  const orderKpi =
    !orderGate
      ? await loadSrmOrderVolumeKpis(prisma, tenant.id, { from: fromStart, to: toEnd, srmKind: kind })
      : null;

  const bookingSla =
    kind === "logistics" ? await loadSrmBookingSlaStats(prisma, tenant.id, { from: fromStart, to: toEnd }) : null;

  return NextResponse.json({
    from: fromStart.toISOString(),
    to: toEnd.toISOString(),
    kind,
    orderKpi,
    orderMetricsRequiresOrdersView: orderGate != null,
    bookingSla,
  });
}
