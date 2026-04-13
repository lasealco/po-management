import { prisma } from "@/lib/prisma";

import { controlTowerOrderWhere } from "./viewer";

const TERMINAL: Array<"DELIVERED" | "RECEIVED"> = ["DELIVERED", "RECEIVED"];

export async function getControlTowerOverview(params: {
  tenantId: string;
  isCustomer: boolean;
}) {
  const { tenantId, isCustomer } = params;
  const orderWhere = controlTowerOrderWhere(isCustomer);

  const now = new Date();
  const d3 = new Date(now);
  d3.setDate(d3.getDate() + 3);
  const d7 = new Date(now);
  d7.setDate(d7.getDate() + 7);
  const d14 = new Date(now);
  d14.setDate(d14.getDate() + 14);
  const staleCut = new Date(now);
  staleCut.setDate(staleCut.getDate() - 7);

  const [
    statusGroups,
    openAlerts,
    openExceptions,
    staleShipments,
    arrivals3,
    arrivals7,
    arrivals14,
  ] = await Promise.all([
    prisma.shipment.groupBy({
      by: ["status"],
      where: { order: { tenantId, ...orderWhere } },
      _count: { _all: true },
    }),
    isCustomer
      ? Promise.resolve(0)
      : prisma.ctAlert.count({
          where: { tenantId, status: "OPEN" },
        }),
    isCustomer
      ? Promise.resolve(0)
      : prisma.ctException.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
        }),
    prisma.shipment.count({
      where: {
        order: { tenantId, ...orderWhere },
        status: { notIn: TERMINAL },
        updatedAt: { lt: staleCut },
      },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId, ...orderWhere },
        booking: { eta: { gte: now, lte: d3 } },
      },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId, ...orderWhere },
        booking: { eta: { gte: now, lte: d7 } },
      },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId, ...orderWhere },
        booking: { eta: { gte: now, lte: d14 } },
      },
    }),
  ]);

  const byStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all]),
  ) as Record<string, number>;
  const active =
    (byStatus.SHIPPED ?? 0) +
    (byStatus.BOOKED ?? 0) +
    (byStatus.IN_TRANSIT ?? 0) +
    (byStatus.VALIDATED ?? 0);

  return {
    generatedAt: now.toISOString(),
    isCustomerView: isCustomer,
    counts: {
      active,
      byStatus,
      openAlerts: isCustomer ? null : openAlerts,
      openExceptions: isCustomer ? null : openExceptions,
      staleShipments,
      arrivalsNext3Days: arrivals3,
      arrivalsNext7Days: arrivals7,
      arrivalsNext14Days: arrivals14,
    },
  };
}
