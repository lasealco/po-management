import { CrmOpportunityStage, CtExceptionStatus, ShipmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  CockpitHeadlineChange,
  CockpitSummary,
  ReportingCockpitSnapshot,
} from "./cockpit-types";

function decimalToNumber(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function priorityByThreshold(value: number, threshold: number): "P1" | "P2" {
  return value >= threshold ? "P1" : "P2";
}

const PO_OVERDUE_REPORT_HREF = "/reports?report=overdue_orders";
const HEADLINE_BASELINE_KEY = "reporting.cockpitHeadlineBaseline";

function isCockpitSummary(o: unknown): o is CockpitSummary {
  if (!o || typeof o !== "object") return false;
  const x = o as Record<string, unknown>;
  const nums = ["openPoCount", "inTransitShipmentCount", "openCtExceptionCount", "activeOpportunityCount", "onHoldInventoryQty", "uninvoicedBillingAmount"];
  return nums.every((k) => typeof x[k] === "number" && Number.isFinite(x[k] as number));
}

function parseHeadlineBaseline(raw: unknown): { generatedAt: string; summary: CockpitSummary } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const generatedAt = typeof r.generatedAt === "string" ? r.generatedAt : null;
  if (!generatedAt || !isCockpitSummary(r.summary)) return null;
  return { generatedAt, summary: r.summary };
}

export async function buildReportingCockpitSnapshot(params: {
  tenantId: string;
  /** When set, snapshot includes headline deltas vs this user’s last stored baseline. */
  actorUserId?: string | null;
  /**
   * When false, baseline is read for headline deltas but not written.
   * Use for one-off rebuilds (e.g. cockpit insight) so we do not advance the baseline without a full page refresh.
   * Default: true whenever `actorUserId` is set.
   */
  persistHeadlineBaseline?: boolean;
}): Promise<ReportingCockpitSnapshot> {
  const now = new Date();
  const ms7 = 7 * 24 * 60 * 60 * 1000;
  const last7Start = new Date(now.getTime() - ms7);
  const prev7Start = new Date(now.getTime() - 2 * ms7);

  const [
    openPoCount,
    overduePoCount,
    inTransitShipmentCount,
    openCtExceptionCount,
    activeOpportunityCount,
    staleOpportunityCount,
    overdueActivityCount,
    onHoldInventoryCount,
    onHoldInventoryQtyAgg,
    poCommitmentAgg,
    inTransitValueAgg,
    weightedPipelineAgg,
    uninvoicedBillingAgg,
  ] = await Promise.all([
    prisma.purchaseOrder.count({
      where: { tenantId: params.tenantId },
    }),
    prisma.purchaseOrder.count({
      where: {
        tenantId: params.tenantId,
        requestedDeliveryDate: { lt: now },
      },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId: params.tenantId },
        status: { in: [ShipmentStatus.BOOKED, ShipmentStatus.IN_TRANSIT] },
      },
    }),
    prisma.ctException.count({
      where: {
        tenantId: params.tenantId,
        status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
      },
    }),
    prisma.crmOpportunity.count({
      where: {
        tenantId: params.tenantId,
        stage: {
          notIn: [CrmOpportunityStage.WON_IMPLEMENTATION_PENDING, CrmOpportunityStage.WON_LIVE, CrmOpportunityStage.LOST],
        },
      },
    }),
    prisma.crmOpportunity.count({
      where: {
        tenantId: params.tenantId,
        closeDate: { lt: now },
        stage: {
          notIn: [CrmOpportunityStage.WON_IMPLEMENTATION_PENDING, CrmOpportunityStage.WON_LIVE, CrmOpportunityStage.LOST],
        },
      },
    }),
    prisma.crmActivity.count({
      where: {
        tenantId: params.tenantId,
        dueDate: { lt: now },
        status: { not: "DONE" },
      },
    }),
    prisma.inventoryBalance.count({
      where: { tenantId: params.tenantId, onHold: true },
    }),
    prisma.inventoryBalance.aggregate({
      where: { tenantId: params.tenantId, onHold: true },
      _sum: { onHandQty: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { tenantId: params.tenantId },
      _sum: { totalAmount: true },
    }),
    prisma.shipment.findMany({
      where: {
        order: { tenantId: params.tenantId },
        status: { in: [ShipmentStatus.BOOKED, ShipmentStatus.IN_TRANSIT] },
      },
      select: { order: { select: { totalAmount: true } } },
      take: 5000,
    }),
    prisma.crmOpportunity.findMany({
      where: {
        tenantId: params.tenantId,
        stage: {
          notIn: [CrmOpportunityStage.WON_IMPLEMENTATION_PENDING, CrmOpportunityStage.WON_LIVE, CrmOpportunityStage.LOST],
        },
      },
      select: { estimatedRevenue: true, probability: true },
      take: 2000,
    }),
    prisma.wmsBillingEvent.aggregate({
      where: { tenantId: params.tenantId, invoiceRunId: null },
      _sum: { amount: true },
    }),
  ]);

  const [
    poCreatedLast7,
    poCreatedPrev7,
    shipmentsCreatedLast7,
    shipmentsCreatedPrev7,
    ctOpenedLast7,
    ctOpenedPrev7,
    crmActivitiesLast7,
    crmActivitiesPrev7,
  ] = await Promise.all([
    prisma.purchaseOrder.count({
      where: { tenantId: params.tenantId, createdAt: { gte: last7Start } },
    }),
    prisma.purchaseOrder.count({
      where: {
        tenantId: params.tenantId,
        createdAt: { gte: prev7Start, lt: last7Start },
      },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId: params.tenantId },
        createdAt: { gte: last7Start },
      },
    }),
    prisma.shipment.count({
      where: {
        order: { tenantId: params.tenantId },
        createdAt: { gte: prev7Start, lt: last7Start },
      },
    }),
    prisma.ctException.count({
      where: { tenantId: params.tenantId, createdAt: { gte: last7Start } },
    }),
    prisma.ctException.count({
      where: {
        tenantId: params.tenantId,
        createdAt: { gte: prev7Start, lt: last7Start },
      },
    }),
    prisma.crmActivity.count({
      where: { tenantId: params.tenantId, createdAt: { gte: last7Start } },
    }),
    prisma.crmActivity.count({
      where: {
        tenantId: params.tenantId,
        createdAt: { gte: prev7Start, lt: last7Start },
      },
    }),
  ]);

  const weightedPipelineAmount = weightedPipelineAgg.reduce((sum, o) => {
    const rev = decimalToNumber(o.estimatedRevenue);
    const p = Math.min(100, Math.max(0, Number(o.probability ?? 0)));
    return sum + (rev * p) / 100;
  }, 0);

  const poCommitment = decimalToNumber(poCommitmentAgg._sum.totalAmount);
  const inTransitValue = inTransitValueAgg.reduce((sum, s) => sum + decimalToNumber(s.order.totalAmount), 0);
  const onHoldQty = decimalToNumber(onHoldInventoryQtyAgg._sum.onHandQty);
  const uninvoicedBillingAmount = decimalToNumber(uninvoicedBillingAgg._sum.amount);

  const summary: CockpitSummary = {
    openPoCount,
    inTransitShipmentCount,
    openCtExceptionCount,
    activeOpportunityCount,
    onHoldInventoryQty: onHoldQty,
    uninvoicedBillingAmount,
  };

  let headlineChange: CockpitHeadlineChange | null = null;
  const actorId = params.actorUserId?.trim();
  const persistBaseline = Boolean(actorId) && params.persistHeadlineBaseline !== false;
  if (actorId) {
    const pref = await prisma.userPreference.findUnique({
      where: { userId_key: { userId: actorId, key: HEADLINE_BASELINE_KEY } },
      select: { value: true },
    });
    const baseline = parseHeadlineBaseline(pref?.value);
    if (baseline) {
      headlineChange = {
        sinceLabel: "Since last cockpit snapshot",
        baselineGeneratedAt: baseline.generatedAt,
        openPoCount: summary.openPoCount - baseline.summary.openPoCount,
        inTransitShipmentCount: summary.inTransitShipmentCount - baseline.summary.inTransitShipmentCount,
        openCtExceptionCount: summary.openCtExceptionCount - baseline.summary.openCtExceptionCount,
        activeOpportunityCount: summary.activeOpportunityCount - baseline.summary.activeOpportunityCount,
        onHoldInventoryQty: summary.onHoldInventoryQty - baseline.summary.onHoldInventoryQty,
        uninvoicedBillingAmount: summary.uninvoicedBillingAmount - baseline.summary.uninvoicedBillingAmount,
      };
    }
    if (persistBaseline) {
      await prisma.userPreference.upsert({
        where: { userId_key: { userId: actorId, key: HEADLINE_BASELINE_KEY } },
        create: {
          tenantId: params.tenantId,
          userId: actorId,
          key: HEADLINE_BASELINE_KEY,
          value: { generatedAt: now.toISOString(), summary },
        },
        update: { value: { generatedAt: now.toISOString(), summary } },
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    currency: "USD",
    summary,
    headlineChange,
    activityTrends: {
      periodLabel: "Last 7 days vs prior 7 days",
      purchaseOrdersCreated: { last7: poCreatedLast7, prev7: poCreatedPrev7 },
      shipmentsCreated: { last7: shipmentsCreatedLast7, prev7: shipmentsCreatedPrev7 },
      ctExceptionsOpened: { last7: ctOpenedLast7, prev7: ctOpenedPrev7 },
      crmActivitiesCreated: { last7: crmActivitiesLast7, prev7: crmActivitiesPrev7 },
    },
    exceptions: [
      {
        id: "ct-open-exceptions",
        label: "Open logistics exceptions",
        count: openCtExceptionCount,
        severity: openCtExceptionCount >= 15 ? "high" : "medium",
        href: "/control-tower/ops?focus=exceptions",
      },
      {
        id: "po-overdue",
        label: "POs past requested delivery",
        count: overduePoCount,
        severity: overduePoCount >= 20 ? "high" : "medium",
        href: PO_OVERDUE_REPORT_HREF,
      },
      {
        id: "crm-stale-opps",
        label: "CRM opportunities past close date",
        count: staleOpportunityCount,
        severity: staleOpportunityCount >= 10 ? "high" : "medium",
        href: "/crm/pipeline",
      },
      {
        id: "crm-overdue-activities",
        label: "CRM overdue activities",
        count: overdueActivityCount,
        severity: overdueActivityCount >= 25 ? "high" : "medium",
        href: "/crm/activities",
      },
      {
        id: "wms-hold-inventory",
        label: "WMS bins on hold",
        count: onHoldInventoryCount,
        severity: onHoldInventoryCount >= 12 ? "high" : "medium",
        href: "/wms/stock",
      },
    ],
    cashCycle: [
      {
        id: "po-commitment",
        label: "PO commitment",
        amount: poCommitment,
        hint: "Total PO value currently in procurement pipeline.",
      },
      {
        id: "in-transit-value",
        label: "In-transit value",
        amount: inTransitValue,
        hint: "Estimated value moving through logistics.",
      },
      {
        id: "weighted-pipeline",
        label: "Weighted CRM pipeline",
        amount: weightedPipelineAmount,
        hint: "Revenue-weighted by opportunity probability.",
      },
      {
        id: "wms-uninvoiced",
        label: "WMS uninvoiced services",
        amount: uninvoicedBillingAmount,
        hint: "Billable WMS events not yet invoiced.",
      },
    ],
    recommendedActions: [
      ...(openCtExceptionCount > 0
        ? [{
            id: "act-ct-exceptions",
            title: "Triage open logistics exceptions",
            reason: `${openCtExceptionCount} exceptions are open/in progress and may impact service levels.`,
            href: "/control-tower/ops?focus=exceptions",
            priority: priorityByThreshold(openCtExceptionCount, 15),
          }]
        : []),
      ...(overduePoCount > 0
        ? [{
            id: "act-po-overdue",
            title: "Review overdue requested delivery dates",
            reason: `${overduePoCount} purchase orders are past requested delivery.`,
            href: PO_OVERDUE_REPORT_HREF,
            priority: priorityByThreshold(overduePoCount, 20),
          }]
        : []),
      ...(staleOpportunityCount > 0
        ? [{
            id: "act-crm-stale",
            title: "Push stale opportunities to next step",
            reason: `${staleOpportunityCount} opportunities are past close/next-step dates.`,
            href: "/crm/pipeline?focus=stale",
            priority: priorityByThreshold(staleOpportunityCount, 10),
          }]
        : []),
      ...(overdueActivityCount > 0
        ? [{
            id: "act-crm-overdue-activities",
            title: "Close overdue CRM activities",
            reason: `${overdueActivityCount} activities are overdue and still open.`,
            href: "/crm/activities?status=OPEN&due=overdue",
            priority: priorityByThreshold(overdueActivityCount, 25),
          }]
        : []),
      ...(onHoldInventoryCount > 0
        ? [{
            id: "act-wms-hold",
            title: "Clear on-hold inventory blockers",
            reason: `${onHoldInventoryCount} hold rows can block picks/replenishment.`,
            href: "/wms/stock?onHold=1",
            priority: priorityByThreshold(onHoldInventoryCount, 12),
          }]
        : []),
    ].slice(0, 4),
  };
}
