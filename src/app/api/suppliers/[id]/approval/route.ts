import { NextResponse } from "next/server";
import { SupplierApprovalStatus } from "@prisma/client";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

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
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }
  const decision = (body as { decision?: string }).decision;
  if (decision !== "approve" && decision !== "reject") {
    return toApiErrorResponse({ error: 'decision must be "approve" or "reject".', code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
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
