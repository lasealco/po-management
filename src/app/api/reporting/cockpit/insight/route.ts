import { NextResponse } from "next/server";

import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildReportingCockpitSnapshot } from "@/lib/reporting/cockpit-data";
import { runCockpitInsightLlm } from "@/lib/reporting/cockpit-insight-llm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const question = typeof obj.question === "string" ? obj.question.trim().slice(0, 2000) : "";

  const actorId = await getActorUserId();
  const snapshot = await buildReportingCockpitSnapshot({
    tenantId: tenant.id,
    actorUserId: actorId,
    persistHeadlineBaseline: false,
  });
  const out = await runCockpitInsightLlm({ snapshot, question: question || null });
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: 503 });
  return NextResponse.json({ insight: out.insight, generatedAt: snapshot.generatedAt });
}
