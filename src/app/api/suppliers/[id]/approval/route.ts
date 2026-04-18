import { NextResponse } from "next/server";
import { SupplierApprovalStatus } from "@prisma/client";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { ensureSupplierOnboardingTasks } from "@/lib/srm/ensure-supplier-onboarding-tasks";
import { assertOnboardingCompleteForApprovedActivation } from "@/lib/srm/supplier-onboarding-activation-guard";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "approve");
  if (gate) return gate;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }
  const decision = (body as { decision?: string }).decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json(
      { error: 'decision must be "approve" or "reject".' },
      { status: 400 },
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (decision === "approve") {
    await ensureSupplierOnboardingTasks(prisma, tenant.id, id);
    const tasks = await prisma.supplierOnboardingTask.findMany({
      where: { supplierId: id, tenantId: tenant.id },
      select: { status: true },
    });
    const gate = assertOnboardingCompleteForApprovedActivation(tasks);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: 409 });
    }
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data:
      decision === "approve"
        ? {
            approvalStatus: SupplierApprovalStatus.approved,
            isActive: true,
          }
        : {
            approvalStatus: SupplierApprovalStatus.rejected,
            isActive: false,
          },
    select: {
      id: true,
      name: true,
      isActive: true,
      approvalStatus: true,
    },
  });

  return NextResponse.json({ supplier });
}
