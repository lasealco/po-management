import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { AssistantEmailThreadStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function pilotGate() {
  if (!isAssistantEmailPilotEnabled()) {
    return toApiErrorResponse({
      error: "Assistant email pilot is disabled.",
      code: "FEATURE_DISABLED",
      status: 404,
    });
  }
  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const pg = pilotGate();
  if (pg) return pg;

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }
  const g = await requireApiGrant("org.orders", "view");
  if (g) return g;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const { id } = await context.params;
  if (!id) {
    return toApiErrorResponse({ error: "Missing id.", code: "BAD_INPUT", status: 400 });
  }

  const row = await prisma.assistantEmailThread.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      linkedCrmAccount: { select: { id: true, name: true, legalName: true } },
      salesOrder: { select: { id: true, soNumber: true, status: true } },
    },
  });
  if (!row) {
    return toApiErrorResponse({ error: "Thread not found.", code: "NOT_FOUND", status: 404 });
  }

  return NextResponse.json({ ok: true, thread: row });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const pg = pilotGate();
  if (pg) return pg;

  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }
  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }
  const g = await requireApiGrant("org.orders", "view");
  if (g) return g;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object body.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const { id } = await context.params;
  if (!id) {
    return toApiErrorResponse({ error: "Missing id.", code: "BAD_INPUT", status: 400 });
  }

  const existing = await prisma.assistantEmailThread.findFirst({
    where: { id, tenantId: tenant.id },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Thread not found.", code: "NOT_FOUND", status: 404 });
  }

  const patch: {
    draftReply?: string | null;
    status?: AssistantEmailThreadStatus;
    linkedCrmAccountId?: string | null;
  } = {};

  if ("draftReply" in o) {
    if (o.draftReply === null) patch.draftReply = null;
    else if (typeof o.draftReply === "string") patch.draftReply = o.draftReply.slice(0, 32_000);
  }

  if (typeof o.status === "string") {
    if (o.status === "RESOLVED" || o.status === "OPEN" || o.status === "REPLIED") {
      patch.status = o.status as AssistantEmailThreadStatus;
    }
  }

  if (o.linkedCrmAccountId === null) {
    patch.linkedCrmAccountId = null;
  } else if (typeof o.linkedCrmAccountId === "string" && o.linkedCrmAccountId.trim()) {
    const acc = await prisma.crmAccount.findFirst({
      where: { id: o.linkedCrmAccountId.trim(), tenantId: tenant.id },
    });
    if (acc) patch.linkedCrmAccountId = acc.id;
  }

  const row = await prisma.assistantEmailThread.update({
    where: { id },
    data: patch,
  });

  return NextResponse.json({ ok: true, thread: row });
}
