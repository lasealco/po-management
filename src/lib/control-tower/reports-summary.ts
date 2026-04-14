import { prisma } from "@/lib/prisma";

import { ctSlaBreachedSeverityBranches } from "./sla-breach-where";
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

  const now = new Date();

  const [byStatus, withBooking, openExceptions, slaBreachedAlerts, slaBreachedExceptions, openSlaEscalationAlerts] =
    await Promise.all([
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
      restricted
        ? Promise.resolve(0)
        : prisma.ctAlert.count({
            where: {
              tenantId,
              status: { in: ["OPEN", "ACKNOWLEDGED"] },
              type: { not: "SLA_ESCALATION" },
              shipment: { is: scope },
              OR: ctSlaBreachedSeverityBranches(now),
            },
          }),
      restricted
        ? Promise.resolve(0)
        : prisma.ctException.count({
            where: {
              tenantId,
              status: { in: ["OPEN", "IN_PROGRESS"] },
              shipment: { is: scope },
              OR: ctSlaBreachedSeverityBranches(now),
            },
          }),
      restricted
        ? Promise.resolve(0)
        : prisma.ctAlert.count({
            where: {
              tenantId,
              status: { in: ["OPEN", "ACKNOWLEDGED"] },
              type: "SLA_ESCALATION",
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
  const [alertOwnerGroups, exceptionOwnerGroups] = restricted
    ? [[], []]
    : await Promise.all([
        prisma.ctAlert.groupBy({
          by: ["ownerUserId"],
          where: {
            tenantId,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
            shipment: { is: scope },
          },
          _count: { _all: true },
        }),
        prisma.ctException.groupBy({
          by: ["ownerUserId"],
          where: {
            tenantId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            shipment: { is: scope },
          },
          _count: { _all: true },
        }),
      ]);
  const ownerIds = Array.from(
    new Set(
      [...alertOwnerGroups, ...exceptionOwnerGroups]
        .map((g) => g.ownerUserId)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const ownerMap = ownerIds.length
    ? new Map(
        (
          await prisma.user.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, name: true },
          })
        ).map((u) => [u.id, u.name]),
      )
    : new Map<string, string>();
  const summarizeOwnerLoad = (
    groups: Array<{ ownerUserId: string | null; _count: { _all: number } }>,
  ) => {
    const unassigned = groups.find((g) => g.ownerUserId === null)?._count._all ?? 0;
    const top = groups
      .filter((g) => g.ownerUserId)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 8)
      .map((g) => ({
        ownerUserId: g.ownerUserId as string,
        ownerName: ownerMap.get(g.ownerUserId as string) ?? "Unknown",
        count: g._count._all,
      }));
    return { unassigned, top };
  };
  const alertOwnerLoad = summarizeOwnerLoad(alertOwnerGroups);
  const exceptionOwnerLoad = summarizeOwnerLoad(exceptionOwnerGroups);
  const ownerCombined = (arr: Array<{ ownerUserId: string; count: number }>) =>
    arr.sort((a, b) => b.count - a.count);
  const combinedMap = new Map<string, number>();
  for (const r of alertOwnerLoad.top) {
    combinedMap.set(r.ownerUserId, (combinedMap.get(r.ownerUserId) ?? 0) + r.count);
  }
  for (const r of exceptionOwnerLoad.top) {
    combinedMap.set(r.ownerUserId, (combinedMap.get(r.ownerUserId) ?? 0) + r.count);
  }
  const combinedTop = ownerCombined(
    Array.from(combinedMap.entries()).map(([ownerUserId, count]) => ({ ownerUserId, count })),
  )
    .slice(0, 8)
    .map((r) => ({
      ownerUserId: r.ownerUserId,
      ownerName: ownerMap.get(r.ownerUserId) ?? "Unknown",
      count: r.count,
    }));
  const capacityThreshold = 12;
  const overloadedOwnerCount = combinedTop.filter((r) => r.count > capacityThreshold).length;
  const underloadedOwnerCount = combinedTop.filter((r) => r.count > 0 && r.count <= 4).length;

  const completedEtaRows = await prisma.shipment.findMany({
    where: {
      ...scope,
      status: { in: ["DELIVERED", "RECEIVED"] },
      receivedAt: { not: null },
      booking: { is: { eta: { not: null } } },
    },
    select: { receivedAt: true, booking: { select: { eta: true } } },
    take: 1200,
    orderBy: { updatedAt: "desc" },
  });
  let onTime = 0;
  let late = 0;
  for (const row of completedEtaRows) {
    const eta = row.booking?.eta;
    const rec = row.receivedAt;
    if (!eta || !rec) continue;
    if (rec.getTime() <= eta.getTime()) onTime += 1;
    else late += 1;
  }
  const etaCompared = onTime + late;

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
      slaBreachedAlerts: restricted ? null : slaBreachedAlerts,
      slaBreachedExceptions: restricted ? null : slaBreachedExceptions,
      openSlaEscalationAlerts: restricted ? null : openSlaEscalationAlerts,
    },
    routeActions,
    ownerLoad: {
      alerts: alertOwnerLoad,
      exceptions: exceptionOwnerLoad,
    },
    ownerBalancing: {
      capacityThreshold,
      overloadedOwnerCount,
      underloadedOwnerCount,
      combinedTop,
    },
    etaPerformance: {
      compared: etaCompared,
      onTime,
      late,
      onTimePct: etaCompared ? Math.round((onTime / etaCompared) * 1000) / 10 : 0,
    },
    byStatus: statusMap,
  };
}
