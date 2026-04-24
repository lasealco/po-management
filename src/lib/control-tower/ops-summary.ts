import { prisma } from "@/lib/prisma";

import {
  controlTowerShipmentAccessWhere,
  type ControlTowerPortalContext,
} from "./viewer";

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getControlTowerOpsSummary(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  actorUserId: string;
}) {
  const { tenantId, ctx, actorUserId } = params;
  const scope = await controlTowerShipmentAccessWhere(tenantId, ctx, actorUserId);
  const restricted = ctx.isRestrictedView;
  const now = new Date();
  const d1 = new Date(now.getTime() - 24 * 3_600_000);
  const d7 = new Date(now.getTime() - 7 * 24 * 3_600_000);

  const [
    backlogAlerts,
    backlogExceptions,
    staleBacklogAlerts,
    staleBacklogExceptions,
    escalationRuns24h,
    // SLA sweep invocations in last 7d (ops_run_sla_escalation; includes dry runs).
    escalationSweepRuns7d,
    escalationActions7d,
    recentOpsAudit,
    ownerLoads,
    exceptionTaxonomy,
    deliveredWithEta,
    mentionAlertsOpen,
    sharedNotes7d,
  ] = await Promise.all([
    restricted
      ? Promise.resolve(0)
      : prisma.ctAlert.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
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
    restricted
      ? Promise.resolve(0)
      : prisma.ctAlert.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
            createdAt: { lt: d7 },
            shipment: { is: scope },
          },
        }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctException.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            createdAt: { lt: d7 },
            shipment: { is: scope },
          },
        }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctAuditLog.count({
          where: {
            tenantId,
            action: "ops_run_sla_escalation",
            createdAt: { gte: d1 },
          },
        }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctAuditLog.count({
          where: {
            tenantId,
            action: "ops_run_sla_escalation",
            createdAt: { gte: d7 },
          },
        }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctAuditLog.count({
          where: {
            tenantId,
            action: "sla_escalation",
            createdAt: { gte: d7 },
          },
        }),
    restricted
      ? Promise.resolve([])
      : prisma.ctAuditLog.findMany({
          where: {
            tenantId,
            action: { in: ["ops_run_sla_escalation", "sla_escalation"] },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { actor: { select: { name: true } } },
        }),
    restricted
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { tenantId, isActive: true },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                ctAlertsOwned: {
                  where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
                },
                ctExceptionsOwned: {
                  where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
                },
              },
            },
          },
          take: 300,
        }),
    restricted
      ? Promise.resolve([])
      : prisma.ctException.groupBy({
          by: ["type"],
          where: {
            tenantId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            shipment: { is: scope },
          },
          _count: { _all: true },
          orderBy: { _count: { type: "desc" } },
          take: 8,
        }),
    prisma.shipment.findMany({
      where: {
        ...scope,
        status: { in: ["DELIVERED", "RECEIVED"] },
        receivedAt: { not: null },
        booking: { is: { eta: { not: null } } },
      },
      select: {
        id: true,
        booking: { select: { eta: true } },
        receivedAt: true,
      },
      take: 1500,
      orderBy: { updatedAt: "desc" },
    }),
    restricted
      ? Promise.resolve(0)
      : prisma.ctAlert.count({
          where: {
            tenantId,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
            type: "COLLAB_MENTION",
            shipment: { is: scope },
          },
        }),
    prisma.ctShipmentNote.count({
      where: {
        tenantId,
        visibility: "SHARED",
        createdAt: { gte: d7 },
        shipment: { is: scope },
      },
    }),
  ]);

  const ownerLoad = ownerLoads
    .map((u) => ({
      id: u.id,
      name: u.name,
      openAlerts: u._count.ctAlertsOwned,
      openExceptions: u._count.ctExceptionsOwned,
      total: u._count.ctAlertsOwned + u._count.ctExceptionsOwned,
    }))
    .sort((a, b) => b.total - a.total);
  const suggestedThreshold = 12;
  const overloaded = ownerLoad.filter((o) => o.total > suggestedThreshold).length;
  const underloaded = ownerLoad.filter((o) => o.total > 0 && o.total <= 4).length;

  const etaStats = deliveredWithEta.reduce(
    (acc, row) => {
      const eta = row.booking?.eta;
      const actual = row.receivedAt;
      if (!eta || !actual) return acc;
      if (actual.getTime() <= eta.getTime()) acc.onTime += 1;
      else acc.delayed += 1;
      return acc;
    },
    { onTime: 0, delayed: 0 },
  );
  const totalEta = etaStats.onTime + etaStats.delayed;

  return {
    generatedAt: now.toISOString(),
    isCustomerView: restricted,
    slaOps: {
      backlogAlerts: restricted ? null : backlogAlerts,
      backlogExceptions: restricted ? null : backlogExceptions,
      staleBacklogAlerts: restricted ? null : staleBacklogAlerts,
      staleBacklogExceptions: restricted ? null : staleBacklogExceptions,
      escalationRuns24h: restricted ? null : escalationRuns24h,
      escalationSweepRuns7d: restricted ? null : escalationSweepRuns7d,
      escalationActions7d: restricted ? null : escalationActions7d,
    },
    ownerBalancing: restricted
      ? null
      : {
          overloadedOwners: overloaded,
          underloadedOwners: underloaded,
          suggestedCapacityThreshold: suggestedThreshold,
          topOwners: ownerLoad.slice(0, 8),
        },
    exceptionLifecycle: restricted
      ? null
      : {
          openByType: exceptionTaxonomy.map((r) => ({
            type: r.type,
            count: r._count._all,
          })),
        },
    routeEta: {
      deliveredCompared: totalEta,
      onTimePct: pct(etaStats.onTime, totalEta),
      delayedPct: pct(etaStats.delayed, totalEta),
      onTimeCount: etaStats.onTime,
      delayedCount: etaStats.delayed,
    },
    collaboration: {
      mentionAlertsOpen: restricted ? null : mentionAlertsOpen,
      sharedNotes7d,
    },
    customerPack: {
      restrictedView: restricted,
      sharedNotes7d,
    },
    automationRules: {
      activeRules: [
        "SLA breach -> follow-up alert + internal note",
        "@mention in note -> COLLAB_MENTION alert",
        "Daily cron escalation sweep",
      ],
    },
    opsConsole: restricted
      ? null
      : {
          recentRuns: recentOpsAudit.map((a) => ({
            id: a.id,
            action: a.action,
            actorName: a.actor.name,
            createdAt: a.createdAt.toISOString(),
          })),
        },
  };
}
