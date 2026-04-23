import { NextResponse } from "next/server";
import { SupplierApprovalStatus } from "@prisma/client";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { assertSupplierApprovalTransition } from "@/lib/srm/supplier-approval-transitions";
import { srmNotificationHook } from "@/lib/srm/srm-notification-hook";

type ApprovalDecision = "approve" | "reject" | "reopen";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "approve");
  if (gate) return gate;

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

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
  if (decision !== "approve" && decision !== "reject" && decision !== "reopen") {
    return toApiErrorResponse({
      error: 'decision must be "approve", "reject", or "reopen".',
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true, name: true, approvalStatus: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const target =
    decision === "approve"
      ? { approvalStatus: SupplierApprovalStatus.approved, isActive: true }
      : decision === "reject"
        ? { approvalStatus: SupplierApprovalStatus.rejected, isActive: false }
        : { approvalStatus: SupplierApprovalStatus.pending_approval, isActive: false };

  const transition = assertSupplierApprovalTransition(
    existing.approvalStatus,
    target.approvalStatus,
  );
  if (!transition.ok) {
    return toApiErrorResponse({ error: transition.error, code: "BAD_INPUT", status: 400 });
  }

  const supplier = await prisma.supplier.update({
    where: { id },
    data: target,
    select: {
      id: true,
      name: true,
      isActive: true,
      approvalStatus: true,
    },
  });

  srmNotificationHook({
    kind: "SUPPLIER_APPROVAL_DECISION",
    tenantId: tenant.id,
    supplierId: supplier.id,
    supplierName: supplier.name,
    decision: decision as ApprovalDecision,
    approvalStatus: supplier.approvalStatus,
    actorUserId,
  });

  return NextResponse.json({ supplier });
}
