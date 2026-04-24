import { NextResponse } from "next/server";

import { getActorUserId, getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { getControlTowerPostActionToolCatalog } from "@/lib/control-tower/assist-tool-catalog";
import { getAssistExecutablePostActionToolRefs } from "@/lib/control-tower/assist-post-action-allowlist";
import { runControlTowerAssist } from "@/lib/control-tower/assist-llm";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const q =
    typeof (body as { q?: unknown }).q === "string" ? (body as { q: string }).q : "";

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  let savedReportsBrief: Array<{ name: string; shared: boolean; mine: boolean }> = [];
  let savedWorkbenchFiltersBrief: Array<{ name: string }> = [];
  if (tenant && actorId) {
    const [reportRows, filterRows] = await Promise.all([
      prisma.ctSavedReport.findMany({
        where: {
          tenantId: tenant.id,
          dataset: "CONTROL_TOWER",
          OR: [{ userId: actorId }, { isShared: true }],
        },
        orderBy: { updatedAt: "desc" },
        take: 24,
        select: { name: true, isShared: true, userId: true },
      }),
      prisma.ctSavedFilter.findMany({
        where: { tenantId: tenant.id, userId: actorId },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: { name: true },
      }),
    ]);
    savedReportsBrief = reportRows.map((r) => ({
      name: r.name,
      shared: r.isShared,
      mine: r.userId === actorId,
    }));
    savedWorkbenchFiltersBrief = filterRows.map((r) => ({ name: r.name }));
  }

  const access = await getViewerGrantSet();
  const canExecutePostActions = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );

  const result = await runControlTowerAssist({
    raw: q,
    savedReportsBrief,
    savedWorkbenchFiltersBrief,
  });
  return NextResponse.json({
    hints: result.hints,
    suggestedFilters: result.suggestedFilters,
    capabilities: result.capabilities,
    usedLlm: result.usedLlm,
    postActionToolCatalog: getControlTowerPostActionToolCatalog(),
    assistExecutablePostActionToolCatalog: getAssistExecutablePostActionToolRefs(),
    assistExecutePostActionPath: "/api/control-tower/assist/execute-post-action",
    canExecuteControlTowerPostActions: canExecutePostActions,
  });
}
