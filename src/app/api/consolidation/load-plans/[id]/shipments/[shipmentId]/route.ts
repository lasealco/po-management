import { NextResponse } from "next/server";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


async function gateBuyerConsolidationAccess() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active demo actor.", code: "FORBIDDEN", status: 403 });
  }
  const isSupplierPortalUser = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplierPortalUser) {
    return toApiErrorResponse({ error: "Supplier users cannot manage buyer consolidation.", code: "FORBIDDEN", status: 403 });
  }
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  return { tenant };
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; shipmentId: string }> },
) {
  const access = await gateBuyerConsolidationAccess();
  if (access instanceof NextResponse) return access;
  const { id: loadPlanId, shipmentId } = await context.params;

  const row = await prisma.loadPlanShipment.findFirst({
    where: {
      loadPlanId,
      shipmentId,
      loadPlan: { tenantId: access.tenant.id },
    },
    include: {
      loadPlan: { select: { status: true } },
    },
  });
  if (!row) {
    return toApiErrorResponse({ error: "Assignment not found.", code: "NOT_FOUND", status: 404 });
  }
  if (row.loadPlan.status !== "DRAFT") {
    return toApiErrorResponse({ error: "Only DRAFT load plans can be changed.", code: "BAD_INPUT", status: 400 });
  }

  await prisma.loadPlanShipment.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
