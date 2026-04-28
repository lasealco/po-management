import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  parseAssistantActionStatus,
  parseAssistantWorkPriority,
  parseOptionalDueAt,
} from "@/lib/assistant/work-engine";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = Object.prototype.hasOwnProperty.call(o, "status") ? parseAssistantActionStatus(o.status) : null;
  if (Object.prototype.hasOwnProperty.call(o, "status") && !status) {
    return toApiErrorResponse({ error: "status must be PENDING, APPROVED, REJECTED, or DONE.", code: "BAD_INPUT", status: 400 });
  }
  const dueAt = Object.prototype.hasOwnProperty.call(o, "dueAt") ? parseOptionalDueAt(o.dueAt) : undefined;
  if (Object.prototype.hasOwnProperty.call(o, "dueAt") && dueAt === undefined) {
    return toApiErrorResponse({ error: "dueAt must be an ISO date or null.", code: "BAD_INPUT", status: 400 });
  }
  const priority = Object.prototype.hasOwnProperty.call(o, "priority") ? parseAssistantWorkPriority(o.priority) : undefined;
  const decisionNote = typeof o.decisionNote === "string" ? o.decisionNote.trim().slice(0, 4000) : undefined;
  const ownerUserId =
    o.ownerUserId === null ? null : typeof o.ownerUserId === "string" && o.ownerUserId.trim() ? o.ownerUserId.trim() : undefined;

  const updated = await prisma.assistantActionQueueItem.updateMany({
    where: { id, tenantId: tenant.id },
    data: {
      ...(status ? { status, decidedAt: status === "PENDING" ? null : new Date() } : {}),
      ...(priority ? { priority } : {}),
      ...(dueAt !== undefined ? { dueAt } : {}),
      ...(decisionNote !== undefined ? { decisionNote: decisionNote || null } : {}),
      ...(ownerUserId !== undefined ? { ownerUserId } : {}),
    },
  });
  if (updated.count === 0) {
    return toApiErrorResponse({ error: "Action queue item not found.", code: "NOT_FOUND", status: 404 });
  }
  return NextResponse.json({ ok: true, status: status ?? "UNCHANGED" });
}
