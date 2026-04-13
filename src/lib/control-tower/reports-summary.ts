import { prisma } from "@/lib/prisma";

import { controlTowerOrderWhere } from "./viewer";

/** Operational KPI snapshot for Control Tower reporting (R4). */
export async function getControlTowerReportsSummary(params: {
  tenantId: string;
  isCustomer: boolean;
}) {
  const { tenantId, isCustomer } = params;
  const orderWhere = controlTowerOrderWhere(isCustomer);

  const [byStatus, withBooking, openExceptions] = await Promise.all([
    prisma.shipment.groupBy({
      by: ["status"],
      where: { order: { tenantId, ...orderWhere } },
      _count: { _all: true },
    }),
    prisma.shipment.count({
      where: { order: { tenantId, ...orderWhere }, booking: { isNot: null } },
    }),
    isCustomer
      ? Promise.resolve(0)
      : prisma.ctException.count({
          where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        }),
  ]);

  const total = byStatus.reduce((s, g) => s + g._count._all, 0);
  const statusMap = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]));

  return {
    generatedAt: new Date().toISOString(),
    isCustomerView: isCustomer,
    totals: {
      shipments: total,
      withBooking,
      openExceptions: isCustomer ? null : openExceptions,
    },
    byStatus: statusMap,
  };
}
