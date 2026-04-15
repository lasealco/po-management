import { CrmOpportunityStage, CtExceptionStatus, ShipmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ReportingCockpitSnapshot } from "./cockpit-types";

function decimalToNumber(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function buildReportingCockpitSnapshot(params: {
  tenantId: string;
}): Promise<ReportingCockpitSnapshot> {
  const now = new Date();

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

  const weightedPipelineAmount = weightedPipelineAgg.reduce((sum, o) => {
    const rev = decimalToNumber(o.estimatedRevenue);
    const p = Math.min(100, Math.max(0, Number(o.probability ?? 0)));
    return sum + (rev * p) / 100;
  }, 0);

  const poCommitment = decimalToNumber(poCommitmentAgg._sum.totalAmount);
  const inTransitValue = inTransitValueAgg.reduce((sum, s) => sum + decimalToNumber(s.order.totalAmount), 0);
  const onHoldQty = decimalToNumber(onHoldInventoryQtyAgg._sum.onHandQty);
  const uninvoicedBillingAmount = decimalToNumber(uninvoicedBillingAgg._sum.amount);

  return {
    generatedAt: now.toISOString(),
    currency: "USD",
    summary: {
      openPoCount,
      inTransitShipmentCount,
      openCtExceptionCount,
      activeOpportunityCount,
      onHoldInventoryQty: onHoldQty,
      uninvoicedBillingAmount,
    },
    exceptions: [
      {
        id: "ct-open-exceptions",
        label: "Open logistics exceptions",
        count: openCtExceptionCount,
        severity: openCtExceptionCount >= 15 ? "high" : "medium",
        href: "/control-tower/ops",
      },
      {
        id: "po-overdue",
        label: "POs past requested delivery",
        count: overduePoCount,
        severity: overduePoCount >= 20 ? "high" : "medium",
        href: "/reports",
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
  };
}
