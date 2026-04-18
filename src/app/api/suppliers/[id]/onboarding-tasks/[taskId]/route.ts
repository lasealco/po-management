import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { parseOnboardingTaskPatchBody } from "@/lib/srm/supplier-onboarding-patch";
import { assertOnboardingStatusChangeAllowed } from "@/lib/srm/supplier-onboarding-workflow";

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
  const parsed = parseOnboardingTaskPatchBody(o);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  if (parsed.data.status !== undefined) {
    const siblings = await prisma.supplierOnboardingTask.findMany({
      where: { supplierId, tenantId: tenant.id },
      select: { taskKey: true, status: true },
    });
    const gate = assertOnboardingStatusChangeAllowed(
      task.taskKey,
      parsed.data.status,
      siblings,
    );
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: 400 });
    }
  }

  const data = { ...parsed.data } as typeof parsed.data & {
    completedAt?: Date | null;
  };
  if (parsed.data.status !== undefined) {
    data.completedAt = parsed.data.status === "done" ? new Date() : null;
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
