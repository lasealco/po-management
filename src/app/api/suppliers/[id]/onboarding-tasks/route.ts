import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, loadGlobalGrantsForUser, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";
import { canViewSupplierSensitiveFieldsForGrantSet } from "@/lib/srm/permissions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const exists = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!exists) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  await ensureSupplierOnboardingTasks(prisma, tenant.id, id);

  const tasks = await prisma.supplierOnboardingTask.findMany({
    where: { tenantId: tenant.id, supplierId: id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
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

  const actorId = await getActorUserId();
  const grantSet = actorId ? await loadGlobalGrantsForUser(actorId) : new Set<string>();
  const canViewSensitive = canViewSupplierSensitiveFieldsForGrantSet(grantSet);

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      taskKey: t.taskKey,
      title: t.title,
      sortOrder: t.sortOrder,
      done: t.done,
      assigneeUserId: t.assigneeUserId,
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.name,
            email: canViewSensitive ? t.assignee.email : null,
          }
        : null,
      dueAt: t.dueAt?.toISOString() ?? null,
      notes: canViewSensitive ? t.notes : null,
    })),
  });
}
