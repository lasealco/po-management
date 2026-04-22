import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { runControlTowerReport } from "@/lib/control-tower/report-engine";
import { buildReportInsightRunSummary } from "@/lib/control-tower/report-run-summary";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const ctx = await getControlTowerPortalContext(actorId);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const config =
    body && typeof body === "object" ? (body as Record<string, unknown>).config ?? {} : {};

  const result = await runControlTowerReport({
    tenantId: tenant.id,
    ctx,
    configInput: config,
    actorUserId: actorId,
  });
  return NextResponse.json({
    ...result,
    runSummary: buildReportInsightRunSummary(result),
  });
}
