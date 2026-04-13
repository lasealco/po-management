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
  const shipmentsForRoute = await prisma.shipment.findMany({
    where: scope,
    select: {
      id: true,
      ctLegs: {
        orderBy: { legNo: "asc" },
        select: {
          plannedEtd: true,
          plannedEta: true,
          actualAtd: true,
          actualAta: true,
        },
      },
    },
    take: 2000,
  });
  const routeActions = {
    planLeg: 0,
    markDeparture: 0,
    recordArrival: 0,
    routeComplete: 0,
    noLegs: 0,
  };
  for (const s of shipmentsForRoute) {
    if (!s.ctLegs.length) {
      routeActions.noLegs += 1;
      continue;
    }
    const phase = s.ctLegs.map((leg) => {
      if (leg.actualAta) return "Arrived";
      if (leg.actualAtd) return "Departed";
      if (leg.plannedEtd || leg.plannedEta) return "Planned";
      return "Draft";
    });
    const next = phase.find((p) => p !== "Arrived");
    if (!next) routeActions.routeComplete += 1;
    else if (next === "Draft") routeActions.planLeg += 1;
    else if (next === "Planned") routeActions.markDeparture += 1;
    else routeActions.recordArrival += 1;
  }

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
    routeActions,
    byStatus: statusMap,
  };
}
