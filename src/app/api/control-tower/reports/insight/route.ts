import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { runReportInsightLlm } from "@/lib/control-tower/report-insight-llm";
import { buildReportInsightRunSummary } from "@/lib/control-tower/report-run-summary";
import { runControlTowerReport, sanitizeCtReportConfig } from "@/lib/control-tower/report-engine";
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
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const question = typeof obj.question === "string" ? obj.question.trim().slice(0, 2000) : "";
  const configRaw = obj.config;

  const config = sanitizeCtReportConfig(configRaw ?? {});
  const result = await runControlTowerReport({
    tenantId: tenant.id,
    ctx,
    configInput: config,
    actorUserId: actorId,
  });

  const out = await runReportInsightLlm({
    result,
    question: question || null,
  });

  if ("error" in out) {
    return toApiErrorResponse({
      error: typeof out.error === "string" ? out.error : "Insight unavailable.",
      code: "UNAVAILABLE",
      status: 503,
      extra: {
        generatedAt: result.generatedAt,
        runSummary: buildReportInsightRunSummary(result),
      },
    });
  }
  return NextResponse.json({
    insight: out.insight,
    generatedAt: result.generatedAt,
    runSummary: buildReportInsightRunSummary(result),
  });
}
