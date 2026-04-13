import { prisma } from "@/lib/prisma";

import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";

const TERMINAL: Array<"DELIVERED" | "RECEIVED"> = ["DELIVERED", "RECEIVED"];

export async function getControlTowerOverview(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
}) {
  const { tenantId, ctx } = params;
  const scope = controlTowerShipmentScopeWhere(tenantId, ctx);
  const restricted = ctx.isRestrictedView;

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
    withLegs,
    withContainers,
    staleTopRows,
  ] = await Promise.all([
    prisma.shipment.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctAlert.count({
          where: {
            tenantId,
            status: "OPEN",
            shipment: { is: scope },
          },
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
    prisma.shipment.count({
      where: {
        ...scope,
        status: { notIn: TERMINAL },
        updatedAt: { lt: staleCut },
      },
    }),
    prisma.shipment.count({
      where: {
        ...scope,
        booking: { eta: { gte: now, lte: d3 } },
      },
    }),
    prisma.shipment.count({
      where: {
        ...scope,
        booking: { eta: { gte: now, lte: d7 } },
      },
    }),
    prisma.shipment.count({
      where: {
        ...scope,
        booking: { eta: { gte: now, lte: d14 } },
      },
    }),
    prisma.shipment.count({
      where: {
        ...scope,
        ctLegs: { some: {} },
      },
    }),
    prisma.shipment.count({
      where: {
        ...scope,
        ctContainers: { some: {} },
      },
    }),
    prisma.shipment.findMany({
      where: {
        ...scope,
        status: { notIn: TERMINAL },
        updatedAt: { lt: staleCut },
      },
      orderBy: { updatedAt: "asc" },
      take: 6,
      select: {
        id: true,
        shipmentNo: true,
        status: true,
        updatedAt: true,
        order: { select: { orderNumber: true } },
        booking: { select: { eta: true } },
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
  const staleTop = staleTopRows.map((s) => ({
    id: s.id,
    shipmentNo: s.shipmentNo,
    orderNumber: s.order.orderNumber,
    status: s.status,
    bookingEta: s.booking?.eta?.toISOString() ?? null,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return {
    generatedAt: now.toISOString(),
    isCustomerView: restricted,
    portal: {
      supplierPortal: ctx.isSupplierPortal,
      customerCrmAccountId: ctx.customerCrmAccountId,
    },
    counts: {
      active,
      byStatus,
      openAlerts: restricted ? null : openAlerts,
      openExceptions: restricted ? null : openExceptions,
      staleShipments,
      arrivalsNext3Days: arrivals3,
      arrivalsNext7Days: arrivals7,
      arrivalsNext14Days: arrivals14,
      withLegs,
      withContainers,
    },
    staleTop,
  };
}
