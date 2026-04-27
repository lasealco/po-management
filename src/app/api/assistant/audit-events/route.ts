import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { inferAssistantObjectContext } from "@/lib/assistant/object-context";

function jsonOrNull(value: unknown) {
  return value == null ? undefined : value;
}

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
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
  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  const answerKind = typeof o.answerKind === "string" ? o.answerKind.trim().slice(0, 32) : "";
  if (!prompt || !answerKind) {
    return toApiErrorResponse({ error: "prompt and answerKind are required.", code: "BAD_INPUT", status: 400 });
  }

  const evidence = Array.isArray(o.evidence) ? (o.evidence as Array<{ href: string }>) : [];
  const inferred = inferAssistantObjectContext({ prompt, evidence });
  const objectType = typeof o.objectType === "string" && o.objectType.trim() ? o.objectType.trim() : inferred.objectType;
  const objectId = typeof o.objectId === "string" && o.objectId.trim() ? o.objectId.trim() : inferred.objectId;

  const event = await prisma.assistantAuditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId,
      surface: typeof o.surface === "string" && o.surface.trim() ? o.surface.trim().slice(0, 64) : "dock",
      prompt,
      answerKind,
      message: typeof o.message === "string" ? o.message : null,
      evidence: jsonOrNull(o.evidence),
      quality: jsonOrNull(o.quality),
      actions: jsonOrNull(o.actions),
      playbook: jsonOrNull(o.playbook),
      objectType,
      objectId,
    },
    select: { id: true, objectType: true, objectId: true, createdAt: true },
  });

  return NextResponse.json({
    auditEvent: {
      ...event,
      createdAt: event.createdAt.toISOString(),
    },
  });
}

export async function GET(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const url = new URL(request.url);
  const objectType = url.searchParams.get("objectType")?.trim() || null;
  const objectId = url.searchParams.get("objectId")?.trim() || null;
  if (!objectType || !objectId) {
    return toApiErrorResponse({ error: "objectType and objectId are required.", code: "BAD_INPUT", status: 400 });
  }

  const events = await prisma.assistantAuditEvent.findMany({
    where: { tenantId: tenant.id, objectType, objectId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      answerKind: true,
      message: true,
      feedback: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return NextResponse.json({
    events: events.map((event) => ({
      ...event,
      actorName: event.actor?.name ?? "Assistant user",
      createdAt: event.createdAt.toISOString(),
    })),
  });
}
