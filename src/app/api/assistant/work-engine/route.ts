import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getViewerGrantSet } from "@/lib/authz";
import { isStaleWork } from "@/lib/assistant/work-engine";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const now = new Date();
  const [actions, templates, runs, memory, users] = await Promise.all([
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId: tenant.id, status: { in: ["PENDING", "APPROVED"] } },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        actionKind: true,
        label: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        objectType: true,
        objectId: true,
        objectHref: true,
        decisionNote: true,
        owner: { select: { id: true, name: true, email: true } },
        createdAt: true,
      },
    }),
    prisma.assistantPlaybookTemplate.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        playbookId: true,
        title: true,
        description: true,
        objectType: true,
        priority: true,
        slaHours: true,
        steps: true,
        updatedAt: true,
      },
    }),
    prisma.assistantPlaybookRun.findMany({
      where: { tenantId: tenant.id, status: { in: ["IN_PROGRESS", "BLOCKED"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        playbookId: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        objectType: true,
        objectId: true,
        objectHref: true,
        steps: true,
        owner: { select: { id: true, name: true, email: true } },
        updatedAt: true,
      },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        surface: true,
        answerKind: true,
        message: true,
        objectType: true,
        objectId: true,
        feedback: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      orderBy: { email: "asc" },
      take: 100,
      select: { id: true, name: true, email: true },
    }),
  ]);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    users,
    metrics: {
      pendingActions: actions.filter((a) => a.status === "PENDING").length,
      staleActions: actions.filter((a) => isStaleWork(now, a.dueAt, a.status)).length,
      activePlaybookRuns: runs.length,
      stalePlaybookRuns: runs.filter((r) => isStaleWork(now, r.dueAt, r.status)).length,
      activeTemplates: templates.length,
      memoryEvents: memory.length,
    },
    actions: actions.map((action) => ({
      ...action,
      stale: isStaleWork(now, action.dueAt, action.status),
      dueAt: action.dueAt?.toISOString() ?? null,
      createdAt: action.createdAt.toISOString(),
    })),
    templates: templates.map((template) => ({ ...template, updatedAt: template.updatedAt.toISOString() })),
    runs: runs.map((run) => ({
      ...run,
      stale: isStaleWork(now, run.dueAt, run.status),
      dueAt: run.dueAt?.toISOString() ?? null,
      updatedAt: run.updatedAt.toISOString(),
    })),
    memory: memory.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  });
}
