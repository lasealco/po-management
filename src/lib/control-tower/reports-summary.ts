import { prisma } from "@/lib/prisma";

import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";

/** Operational KPI snapshot for Control Tower reporting (R4). */
export async function getControlTowerReportsSummary(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
}) {
  const { tenantId, ctx } = params;
  const scope = controlTowerShipmentScopeWhere(tenantId, ctx);
  const restricted = ctx.isRestrictedView;

  const [byStatus, withBooking, openExceptions] = await Promise.all([
    prisma.shipment.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.shipment.count({
      where: { ...scope, booking: { isNot: null } },
    }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctException.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            shipment: { is: scope },
          },
        }),
  ]);

  const total = byStatus.reduce((s, g) => s + g._count._all, 0);
  const statusMap = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]));

  return {
    generatedAt: new Date().toISOString(),
    isCustomerView: restricted,
    portal: {
      supplierPortal: ctx.isSupplierPortal,
      customerCrmAccountId: ctx.customerCrmAccountId,
    },
    totals: {
      shipments: total,
      withBooking,
      openExceptions: restricted ? null : openExceptions,
    },
    byStatus: statusMap,
  };
}
