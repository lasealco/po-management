import { NextResponse } from "next/server";
import type { SupplierOnboardingTaskStatus } from "@prisma/client";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const STATUSES = new Set<SupplierOnboardingTaskStatus>(["pending", "done", "waived"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; taskId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, taskId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const task = await prisma.supplierOnboardingTask.findFirst({
    where: { id: taskId, supplierId, tenantId: tenant.id },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const data: {
    status?: SupplierOnboardingTaskStatus;
    notes?: string | null;
    completedAt?: Date | null;
  } = {};

  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !STATUSES.has(o.status as SupplierOnboardingTaskStatus)) {
      return NextResponse.json({ error: "status must be pending, done, or waived." }, { status: 400 });
    }
    const status = o.status as SupplierOnboardingTaskStatus;
    data.status = status;
    data.completedAt = status === "done" ? new Date() : null;
  }

  if (o.notes !== undefined) {
    if (o.notes === null) data.notes = null;
    else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      data.notes = t ? t.slice(0, 8000) : null;
    } else {
      return NextResponse.json({ error: "Invalid notes." }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const row = await prisma.supplierOnboardingTask.update({
    where: { id: taskId },
    data,
  });

  return NextResponse.json({
    task: {
      id: row.id,
      taskKey: row.taskKey,
      label: row.label,
      sortOrder: row.sortOrder,
      status: row.status,
      notes: row.notes,
      completedAt: row.completedAt?.toISOString() ?? null,
    },
  });
}
