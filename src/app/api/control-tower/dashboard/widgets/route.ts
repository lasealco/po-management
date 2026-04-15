import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { runControlTowerReport, sanitizeCtReportConfig } from "@/lib/control-tower/report-engine";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });
  const ctx = await getControlTowerPortalContext(actorId);

  const widgets = await prisma.ctDashboardWidget.findMany({
    where: { tenantId: tenant.id, userId: actorId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      sortOrder: true,
      layoutJson: true,
      savedReport: {
        select: { id: true, name: true, configJson: true, updatedAt: true },
      },
    },
  });

  const withData = await Promise.all(
    widgets.map(async (w) => {
      const config = sanitizeCtReportConfig(w.savedReport.configJson);
      const result = await runControlTowerReport({
        tenantId: tenant.id,
        ctx,
        configInput: config,
        actorUserId: actorId,
      });
      return {
        id: w.id,
        title: w.title,
        sortOrder: w.sortOrder,
        layout: w.layoutJson,
        savedReport: {
          id: w.savedReport.id,
          name: w.savedReport.name,
          updatedAt: w.savedReport.updatedAt.toISOString(),
          config: sanitizeCtReportConfig(w.savedReport.configJson) as Record<string, unknown>,
        },
        report: result,
      };
    }),
  );

  return NextResponse.json({ widgets: withData });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const actorId = await getActorUserId();
  if (!actorId) return NextResponse.json({ error: "No active user." }, { status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const savedReportId = typeof obj.savedReportId === "string" ? obj.savedReportId : "";
  if (!savedReportId) return NextResponse.json({ error: "savedReportId is required." }, { status: 400 });

  const report = await prisma.ctSavedReport.findFirst({
    where: { id: savedReportId, tenantId: tenant.id, OR: [{ userId: actorId }, { isShared: true }] },
    select: { id: true, name: true },
  });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const titleRaw = typeof obj.title === "string" ? obj.title.trim() : "";
  const maxOrder = await prisma.ctDashboardWidget.aggregate({
    where: { tenantId: tenant.id, userId: actorId },
    _max: { sortOrder: true },
  });
  const created = await prisma.ctDashboardWidget.create({
    data: {
      tenantId: tenant.id,
      userId: actorId,
      savedReportId: report.id,
      title: (titleRaw || report.name).slice(0, 120),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      layoutJson: obj.layoutJson && typeof obj.layoutJson === "object" ? (obj.layoutJson as object) : undefined,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
