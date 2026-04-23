import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, taskId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const task = await prisma.supplierOnboardingTask.findFirst({
    where: { id: taskId, tenantId: tenant.id, supplierId },
    select: { id: true },
  });
  if (!task) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const o = body as Record<string, unknown>;
  const data: {
    done?: boolean;
    assigneeUserId?: string | null;
    dueAt?: Date | null;
    notes?: string | null;
  } = {};

  if ("done" in o) {
    data.done = Boolean(o.done);
  }
  if ("assigneeUserId" in o) {
    const v = o.assigneeUserId;
    if (v === null) {
      data.assigneeUserId = null;
    } else if (typeof v === "string" && v.trim()) {
      const uid = v.trim();
      const u = await prisma.user.findFirst({
        where: { id: uid, tenantId: tenant.id, isActive: true },
        select: { id: true },
      });
      if (!u) {
        return toApiErrorResponse({
          error: "assigneeUserId must be null or an active user in this tenant.",
          code: "BAD_INPUT",
          status: 400,
        });
      }
      data.assigneeUserId = uid;
    } else {
      return toApiErrorResponse({ error: "Invalid assigneeUserId.", code: "BAD_INPUT", status: 400 });
    }
  }
  if ("dueAt" in o) {
    const v = o.dueAt;
    if (v === null || v === "") {
      data.dueAt = null;
    } else if (typeof v === "string") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return toApiErrorResponse({ error: "dueAt must be a valid ISO date string.", code: "BAD_INPUT", status: 400 });
      }
      data.dueAt = d;
    } else {
      return toApiErrorResponse({ error: "Invalid dueAt.", code: "BAD_INPUT", status: 400 });
    }
  }
  if ("notes" in o) {
    const v = o.notes;
    if (v === null) {
      data.notes = null;
    } else if (typeof v === "string") {
      data.notes = v.length > 4000 ? v.slice(0, 4000) : v;
    } else {
      return toApiErrorResponse({ error: "Invalid notes.", code: "BAD_INPUT", status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No valid fields to update.", code: "BAD_INPUT", status: 400 });
  }

  const updated = await prisma.supplierOnboardingTask.update({
    where: { id: taskId },
    data,
    select: {
      id: true,
      taskKey: true,
      title: true,
      sortOrder: true,
      done: true,
      assigneeUserId: true,
      dueAt: true,
      notes: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    task: {
      id: updated.id,
      taskKey: updated.taskKey,
      title: updated.title,
      sortOrder: updated.sortOrder,
      done: updated.done,
      assigneeUserId: updated.assigneeUserId,
      assignee: updated.assignee,
      dueAt: updated.dueAt?.toISOString() ?? null,
      notes: updated.notes,
    },
  });
}
