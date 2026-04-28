import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { computeDueAtFromSla, normalizePlaybookSteps, parseAssistantWorkPriority } from "@/lib/assistant/work-engine";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const templates = await prisma.assistantPlaybookTemplate.findMany({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
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
  });
  return NextResponse.json({ templates: templates.map((t) => ({ ...t, updatedAt: t.updatedAt.toISOString() })) });
}

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 180) : "";
  const playbookId =
    typeof o.playbookId === "string" && o.playbookId.trim()
      ? o.playbookId.trim().slice(0, 128)
      : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
  const steps = normalizePlaybookSteps(o.steps);
  if (!title || !playbookId || !steps) {
    return toApiErrorResponse({ error: "title, playbookId, and at least one step are required.", code: "BAD_INPUT", status: 400 });
  }
  const slaHours = typeof o.slaHours === "number" && Number.isFinite(o.slaHours) ? Math.max(1, Math.min(2160, Math.floor(o.slaHours))) : null;
  const template = await prisma.assistantPlaybookTemplate.upsert({
    where: { tenantId_playbookId: { tenantId: tenant.id, playbookId } },
    update: {
      title,
      description: typeof o.description === "string" ? o.description.trim().slice(0, 2000) || null : null,
      objectType: typeof o.objectType === "string" && o.objectType.trim() ? o.objectType.trim().slice(0, 64) : null,
      priority: parseAssistantWorkPriority(o.priority),
      slaHours,
      steps,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      createdByUserId: actorUserId,
      playbookId,
      title,
      description: typeof o.description === "string" ? o.description.trim().slice(0, 2000) || null : null,
      objectType: typeof o.objectType === "string" && o.objectType.trim() ? o.objectType.trim().slice(0, 64) : null,
      priority: parseAssistantWorkPriority(o.priority),
      slaHours,
      steps,
    },
    select: { id: true, playbookId: true, title: true, priority: true, slaHours: true, steps: true },
  });
  return NextResponse.json({
    template,
    previewDueAt: computeDueAtFromSla(new Date(), slaHours)?.toISOString() ?? null,
  });
}
