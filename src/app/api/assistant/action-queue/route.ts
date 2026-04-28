import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { inferAssistantObjectContext } from "@/lib/assistant/object-context";
import { parseAssistantWorkPriority, parseOptionalDueAt } from "@/lib/assistant/work-engine";

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
  const action = o.action && typeof o.action === "object" ? (o.action as Record<string, unknown>) : null;
  const actionId = typeof action?.id === "string" ? action.id.trim() : "";
  const actionKind = typeof action?.kind === "string" ? action.kind.trim() : "";
  const label = typeof action?.label === "string" ? action.label.trim() : "";
  if (!action || !actionId || !actionKind || !label) {
    return toApiErrorResponse({ error: "action id, kind, and label are required.", code: "BAD_INPUT", status: 400 });
  }
  const auditEventId = typeof o.auditEventId === "string" && o.auditEventId.trim() ? o.auditEventId.trim() : null;
  const inferred = inferAssistantObjectContext({
    prompt: typeof o.prompt === "string" ? o.prompt : "",
    evidence: actionKind === "navigate" && typeof action.href === "string" ? [{ href: action.href }] : [],
  });
  const payload = action as Prisma.InputJsonObject;
  const dueAt = parseOptionalDueAt(o.dueAt ?? action.dueAt);
  const item = await prisma.assistantActionQueueItem.create({
    data: {
      tenantId: tenant.id,
      actorUserId,
      auditEventId,
      objectType: typeof o.objectType === "string" && o.objectType.trim() ? o.objectType.trim() : inferred.objectType,
      objectId: typeof o.objectId === "string" && o.objectId.trim() ? o.objectId.trim() : inferred.objectId,
      objectHref:
        typeof o.objectHref === "string" && o.objectHref.trim()
          ? o.objectHref.trim().slice(0, 2048)
          : typeof action.href === "string"
            ? action.href.trim().slice(0, 2048)
            : null,
      ownerUserId: typeof o.ownerUserId === "string" && o.ownerUserId.trim() ? o.ownerUserId.trim() : null,
      dueAt: dueAt ?? null,
      priority: parseAssistantWorkPriority(o.priority ?? action.priority),
      actionId: actionId.slice(0, 128),
      actionKind: actionKind.slice(0, 64),
      label,
      description: typeof action.description === "string" ? action.description : null,
      payload,
    },
    select: { id: true, status: true, createdAt: true },
  });
  return NextResponse.json({ item: { ...item, createdAt: item.createdAt.toISOString() } });
}

export async function GET(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || "PENDING";
  const items = await prisma.assistantActionQueueItem.findMany({
    where: { tenantId: tenant.id, status },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      actionKind: true,
      label: true,
      description: true,
      status: true,
      objectType: true,
      objectId: true,
      objectHref: true,
      ownerUserId: true,
      owner: { select: { id: true, name: true, email: true } },
      priority: true,
      dueAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      dueAt: item.dueAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
