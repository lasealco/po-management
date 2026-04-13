import type { Prisma } from "@prisma/client";

import { userHasRoleNamed } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export type ControlTowerPortalContext = {
  /** Strip internal financials, audit, etc. */
  isRestrictedView: boolean;
  isSupplierPortal: boolean;
  /** When set, only shipments explicitly tagged for this CRM account are visible. */
  customerCrmAccountId: string | null;
};

export async function getControlTowerPortalContext(
  actorUserId: string,
): Promise<ControlTowerPortalContext> {
  const [isSupplierPortal, user] = await Promise.all([
    userHasRoleNamed(actorUserId, "Supplier portal"),
    prisma.user.findUnique({
      where: { id: actorUserId },
      select: { customerCrmAccountId: true },
    }),
  ]);
  const customerCrmAccountId = user?.customerCrmAccountId ?? null;
  return {
    isRestrictedView: isSupplierPortal || Boolean(customerCrmAccountId),
    isSupplierPortal,
    customerCrmAccountId,
  };
}

/** @deprecated use context.isRestrictedView */
export async function isControlTowerCustomerView(actorUserId: string) {
  const ctx = await getControlTowerPortalContext(actorUserId);
  return ctx.isRestrictedView;
}

/**
 * Shipment rows visible in Control Tower for this viewer (tenant + supplier portal + CRM customer scope).
 */
export function controlTowerShipmentScopeWhere(
  tenantId: string,
  ctx: ControlTowerPortalContext,
): Prisma.ShipmentWhereInput {
  const orderWhere: Prisma.PurchaseOrderWhereInput = { tenantId };
  if (ctx.isSupplierPortal) {
    orderWhere.workflow = { supplierPortalOn: true };
  }
  const where: Prisma.ShipmentWhereInput = { order: orderWhere };
  if (ctx.customerCrmAccountId) {
    where.customerCrmAccountId = ctx.customerCrmAccountId;
  }
  return where;
}
