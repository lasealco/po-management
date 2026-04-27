import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { inferAssistantObjectContext } from "@/lib/assistant/object-context";

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const playbook = o.playbook && typeof o.playbook === "object" ? (o.playbook as Record<string, unknown>) : null;
  const playbookId = typeof playbook?.id === "string" ? playbook.id.trim() : "";
  const title = typeof playbook?.title === "string" ? playbook.title.trim() : "";
  const steps = Array.isArray(playbook?.steps) ? playbook.steps : null;
  if (!playbook || !playbookId || !title || !steps) {
    return toApiErrorResponse({ error: "playbook id, title, and steps are required.", code: "BAD_INPUT", status: 400 });
  }
  const inferred = inferAssistantObjectContext({ prompt: typeof o.prompt === "string" ? o.prompt : "" });
  const run = await prisma.assistantPlaybookRun.create({
    data: {
      tenantId: tenant.id,
      actorUserId,
      auditEventId: typeof o.auditEventId === "string" && o.auditEventId.trim() ? o.auditEventId.trim() : null,
      objectType: typeof o.objectType === "string" && o.objectType.trim() ? o.objectType.trim() : inferred.objectType,
      objectId: typeof o.objectId === "string" && o.objectId.trim() ? o.objectId.trim() : inferred.objectId,
      playbookId: playbookId.slice(0, 128),
      title,
      steps,
    },
    select: { id: true, status: true, createdAt: true },
  });
  return NextResponse.json({ run: { ...run, createdAt: run.createdAt.toISOString() } });
}

export async function GET(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const url = new URL(request.url);
  const objectType = url.searchParams.get("objectType")?.trim() || null;
  const objectId = url.searchParams.get("objectId")?.trim() || null;
  if (!objectType || !objectId) {
    return toApiErrorResponse({ error: "objectType and objectId are required.", code: "BAD_INPUT", status: 400 });
  }
  const runs = await prisma.assistantPlaybookRun.findMany({
    where: { tenantId: tenant.id, objectType, objectId },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: { id: true, playbookId: true, title: true, status: true, steps: true, updatedAt: true },
  });
  return NextResponse.json({ runs: runs.map((run) => ({ ...run, updatedAt: run.updatedAt.toISOString() })) });
}
