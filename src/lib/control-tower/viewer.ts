import type { Prisma } from "@prisma/client";

import { userHasRoleNamed, userIsSuperuser } from "@/lib/authz";
import { getPurchaseOrderScopeWhere } from "@/lib/org-scope";
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
  if (await userIsSuperuser(actorUserId)) {
    return {
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    };
  }
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

/** PO-side filter: tenant + optional supplier-portal workflow. */
export function controlTowerBaseOrderWhere(
  tenantId: string,
  ctx: ControlTowerPortalContext,
): Prisma.PurchaseOrderWhereInput {
  const orderWhere: Prisma.PurchaseOrderWhereInput = { tenantId };
  if (ctx.isSupplierPortal) {
    orderWhere.workflow = { supplierPortalOn: true };
  }
  return orderWhere;
}

/**
 * Shipment rows visible in Control Tower for this viewer (tenant + supplier portal + CRM customer scope).
 * Does **not** apply internal org/division read scope; prefer {@link controlTowerShipmentAccessWhere} for API paths.
 */
export function controlTowerShipmentScopeWhere(
  tenantId: string,
  ctx: ControlTowerPortalContext,
): Prisma.ShipmentWhereInput {
  const where: Prisma.ShipmentWhereInput = { order: controlTowerBaseOrderWhere(tenantId, ctx) };
  if (ctx.customerCrmAccountId) {
    where.customerCrmAccountId = ctx.customerCrmAccountId;
  }
  return where;
}

/**
 * Full CT shipment read scope: portal/customer rules plus the same org/division rules as purchase orders
 * (linked `order.requester`, `order.servedOrgUnitId`, + line product divisions). Superusers and supplier portal
 * bypass org filter inside `getPurchaseOrderScopeWhere`.
 */
export async function controlTowerShipmentAccessWhere(
  tenantId: string,
  ctx: ControlTowerPortalContext,
  actorUserId: string,
): Promise<Prisma.ShipmentWhereInput> {
  const baseOrder = controlTowerBaseOrderWhere(tenantId, ctx);
  const orgScope = await getPurchaseOrderScopeWhere(tenantId, actorUserId, {
    isSupplierPortalUser: ctx.isSupplierPortal,
  });
  const orderParts: Prisma.PurchaseOrderWhereInput[] = [baseOrder];
  if (orgScope) {
    orderParts.push(orgScope);
  }
  const orderClause: Prisma.PurchaseOrderWhereInput =
    orderParts.length === 1 ? orderParts[0]! : { AND: orderParts };
  const where: Prisma.ShipmentWhereInput = { order: orderClause };
  if (ctx.customerCrmAccountId) {
    where.customerCrmAccountId = ctx.customerCrmAccountId;
  }
  return where;
}
