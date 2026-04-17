import { CrmOpportunityStage, CtExceptionStatus, ShipmentStatus } from "@prisma/client";

import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [yy, mm] = key.split("-");
  const dt = new Date(Date.UTC(Number(yy), Number(mm) - 1, 1));
  return dt.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export type ExecutiveSummary = {
  asOfIso: string;
  health: {
    score: number;
    grade: "A" | "B" | "C" | "D";
    narrative: string;
  };
  insights: Array<{
    title: string;
    detail: string;
    tone: "positive" | "warning" | "critical";
  }>;
  decisionsNext7Days: Array<{
    title: string;
    owner: string;
    reason: string;
  }>;
  kpis: {
    weightedPipelineValue: number;
    openPoValue: number;
    inTransitValueEstimate: number;
    estimatedLogisticsSpend: number;
    estimatedLogisticsSpendPct: number | null;
    demandCoverageRatio: number | null;
    estimatedRevenueAtRisk: number;
    openExceptions: number;
    delayedInboundShipments: number;
    criticalStockOutRiskCount: number;
  };
  momentum: {
    weightedPipelinePctVsPrev30d: number | null;
    openExceptionsPctVsPrev30d: number | null;
    delayedInboundPctVsPrev30d: number | null;
    stockOutRiskPctVsPrev30d: number | null;
  };
  trends: Array<{
    month: string;
    weightedPipelineValue: number;
    openPoValue: number;
    estimatedLogisticsSpend: number;
  }>;
  actionPanel: {
    stockOutRisks: Array<{
      productId: string;
      productCode: string;
      productName: string;
      availableQty: number;
      allocatedQty: number;
      shortageQty: number;
    }>;
    delayedInbound: Array<{
      shipmentId: string;
      shipmentNo: string;
      eta: string | null;
      customer: string;
      supplier: string;
      status: ShipmentStatus;
      delayDays: number;
    }>;
    customersAtRisk: Array<{
      customer: string;
      delayedShipmentCount: number;
    }>;
    suppliersAtRisk: Array<{
      supplier: string;
      delayedShipmentCount: number;
    }>;
  };
};

export async function buildExecutiveSummary(params: {
  tenantId: string;
  actorUserId: string;
}): Promise<ExecutiveSummary> {
  const { tenantId, actorUserId } = params;
  const ctx = await getControlTowerPortalContext(actorUserId);
  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prev30 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    openPoAgg,
    weightedOppRows,
    exceptionCount,
    stockRiskRows,
    delayedInboundRows,
    weightedOppLast30,
    weightedOppPrev30,
    exceptionLast30,
    exceptionPrev30,
    delayedInboundLast30,
    delayedInboundPrev30,
    stockRiskLast30Rows,
    stockRiskPrev30Rows,
  ] =
    await Promise.all([
      prisma.purchaseOrder.aggregate({
        where: {
          tenantId,
          splitParentId: null,
          status: { isEnd: false },
        },
        _sum: { totalAmount: true },
      }),
      prisma.crmOpportunity.findMany({
        where: {
          tenantId,
          stage: {
            notIn: [
              CrmOpportunityStage.WON_IMPLEMENTATION_PENDING,
              CrmOpportunityStage.WON_LIVE,
              CrmOpportunityStage.LOST,
            ],
          },
          estimatedRevenue: { not: null },
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          estimatedRevenue: true,
          probability: true,
          createdAt: true,
        },
      }),
      prisma.ctException.count({
        where: {
          tenantId,
          status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
        },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId },
        select: {
          productId: true,
          onHandQty: true,
          allocatedQty: true,
          product: {
            select: { productCode: true, sku: true, name: true },
          },
        },
        take: 2000,
      }),
      prisma.shipment.findMany({
        where: {
          order: { tenantId },
          customerCrmAccountId: ctx.customerCrmAccountId ?? undefined,
          status: { in: [ShipmentStatus.BOOKED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED] },
          receivedAt: null,
          booking: {
            is: {
              OR: [{ latestEta: { lt: now } }, { eta: { lt: now } }],
            },
          },
        },
        select: {
          id: true,
          shipmentNo: true,
          status: true,
          customerCrmAccount: { select: { name: true } },
          booking: {
            select: {
              eta: true,
              latestEta: true,
              forwarderSupplier: { select: { name: true } },
            },
          },
          carrier: true,
          order: { select: { totalAmount: true, createdAt: true } },
          ctFinancialSnapshots: {
            orderBy: { asOf: "desc" },
            take: 1,
            select: { customerVisibleCost: true, internalCost: true, asOf: true },
          },
        },
        orderBy: { shippedAt: "desc" },
        take: 50,
      }),
      prisma.crmOpportunity.findMany({
        where: {
          tenantId,
          stage: {
            notIn: [
              CrmOpportunityStage.WON_IMPLEMENTATION_PENDING,
              CrmOpportunityStage.WON_LIVE,
              CrmOpportunityStage.LOST,
            ],
          },
          estimatedRevenue: { not: null },
          createdAt: { gte: last30 },
        },
        select: { estimatedRevenue: true, probability: true },
      }),
      prisma.crmOpportunity.findMany({
        where: {
          tenantId,
          stage: {
            notIn: [
              CrmOpportunityStage.WON_IMPLEMENTATION_PENDING,
              CrmOpportunityStage.WON_LIVE,
              CrmOpportunityStage.LOST,
            ],
          },
          estimatedRevenue: { not: null },
          createdAt: { gte: prev30, lt: last30 },
        },
        select: { estimatedRevenue: true, probability: true },
      }),
      prisma.ctException.count({
        where: {
          tenantId,
          status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
          createdAt: { gte: last30 },
        },
      }),
      prisma.ctException.count({
        where: {
          tenantId,
          status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
          createdAt: { gte: prev30, lt: last30 },
        },
      }),
      prisma.shipment.count({
        where: {
          order: { tenantId },
          customerCrmAccountId: ctx.customerCrmAccountId ?? undefined,
          status: { in: [ShipmentStatus.BOOKED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED] },
          receivedAt: null,
          booking: {
            is: {
              OR: [{ latestEta: { lt: now } }, { eta: { lt: now } }],
            },
          },
          createdAt: { gte: last30 },
        },
      }),
      prisma.shipment.count({
        where: {
          order: { tenantId },
          customerCrmAccountId: ctx.customerCrmAccountId ?? undefined,
          status: { in: [ShipmentStatus.BOOKED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED] },
          receivedAt: null,
          booking: {
            is: {
              OR: [{ latestEta: { lt: now } }, { eta: { lt: now } }],
            },
          },
          createdAt: { gte: prev30, lt: last30 },
        },
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId, updatedAt: { gte: last30 } },
        select: { onHandQty: true, allocatedQty: true },
        take: 2000,
      }),
      prisma.inventoryBalance.findMany({
        where: { tenantId, updatedAt: { gte: prev30, lt: last30 } },
        select: { onHandQty: true, allocatedQty: true },
        take: 2000,
      }),
    ]);

  const delayedInbound = delayedInboundRows.map((s) => {
    const etaDate = s.booking?.latestEta ?? s.booking?.eta ?? null;
    const delayDays = etaDate ? Math.max(0, Math.round((now.getTime() - etaDate.getTime()) / 86400000)) : 0;
    return {
      shipmentId: s.id,
      shipmentNo: s.shipmentNo ?? "—",
      eta: etaDate ? etaDate.toISOString() : null,
      customer: s.customerCrmAccount?.name ?? "Unassigned customer",
      supplier:
        s.booking?.forwarderSupplier?.name ??
        s.carrier ??
        "Unassigned logistics partner",
      status: s.status,
      delayDays,
    };
  });

  const delayedInboundShipments = delayedInbound.length;
  const customersAtRisk = Array.from(
    delayedInbound.reduce((m, row) => {
      m.set(row.customer, (m.get(row.customer) ?? 0) + 1);
      return m;
    }, new Map<string, number>()),
  )
    .map(([customer, delayedShipmentCount]) => ({ customer, delayedShipmentCount }))
    .sort((a, b) => b.delayedShipmentCount - a.delayedShipmentCount)
    .slice(0, 5);
  const suppliersAtRisk = Array.from(
    delayedInbound.reduce((m, row) => {
      m.set(row.supplier, (m.get(row.supplier) ?? 0) + 1);
      return m;
    }, new Map<string, number>()),
  )
    .map(([supplier, delayedShipmentCount]) => ({ supplier, delayedShipmentCount }))
    .sort((a, b) => b.delayedShipmentCount - a.delayedShipmentCount)
    .slice(0, 5);

  const stockOutRisks = stockRiskRows
    .map((r) => {
      const onHand = n(r.onHandQty);
      const allocated = n(r.allocatedQty);
      const available = onHand - allocated;
      const shortage = Math.max(0, allocated - onHand);
      return {
        productId: r.productId,
        productCode: r.product.productCode ?? r.product.sku ?? "—",
        productName: r.product.name,
        availableQty: available,
        allocatedQty: allocated,
        shortageQty: shortage,
      };
    })
    .filter((r) => r.shortageQty > 0)
    .sort((a, b) => b.shortageQty - a.shortageQty)
    .slice(0, 5);

  const criticalStockOutRiskCount = stockOutRisks.length;
  const openPoValue = n(openPoAgg._sum.totalAmount);
  const weightedPipelineValue = weightedOppRows.reduce((sum, row) => {
    const probability = Math.min(100, Math.max(0, n(row.probability)));
    return sum + (n(row.estimatedRevenue) * probability) / 100;
  }, 0);

  const inTransitValueEstimate = delayedInboundRows.reduce((sum, row) => sum + n(row.order.totalAmount), 0);
  const estimatedLogisticsSpend = delayedInboundRows.reduce((sum, row) => {
    const snap = row.ctFinancialSnapshots[0];
    return sum + n(snap?.internalCost ?? snap?.customerVisibleCost);
  }, 0);
  const estimatedDemandBase = openPoValue + weightedPipelineValue;
  const estimatedLogisticsSpendPct =
    estimatedDemandBase > 0 ? (estimatedLogisticsSpend / estimatedDemandBase) * 100 : null;
  const supplyValue = openPoValue + inTransitValueEstimate;
  const demandCoverageRatio =
    weightedPipelineValue > 0 ? (supplyValue / weightedPipelineValue) * 100 : null;
  const estimatedRevenueAtRisk = delayedInboundRows.reduce(
    (sum, row) => sum + n(row.order.totalAmount),
    0,
  );
  const weightedLast30 = weightedOppLast30.reduce((sum, row) => {
    const probability = Math.min(100, Math.max(0, n(row.probability)));
    return sum + (n(row.estimatedRevenue) * probability) / 100;
  }, 0);
  const weightedPrev30 = weightedOppPrev30.reduce((sum, row) => {
    const probability = Math.min(100, Math.max(0, n(row.probability)));
    return sum + (n(row.estimatedRevenue) * probability) / 100;
  }, 0);
  const stockRiskLast30 = stockRiskLast30Rows.filter((r) => n(r.allocatedQty) > n(r.onHandQty)).length;
  const stockRiskPrev30 = stockRiskPrev30Rows.filter((r) => n(r.allocatedQty) > n(r.onHandQty)).length;
  const pctDelta = (current: number, previous: number): number | null => {
    if (previous <= 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };
  const riskPressure =
    (estimatedRevenueAtRisk > 0 ? 20 : 0) +
    Math.min(25, delayedInboundShipments * 4) +
    Math.min(20, exceptionCount * 2) +
    Math.min(25, criticalStockOutRiskCount * 5);
  const coverageBonus =
    demandCoverageRatio == null ? 0 : demandCoverageRatio >= 100 ? 20 : demandCoverageRatio >= 85 ? 10 : 0;
  const spendPenalty =
    estimatedLogisticsSpendPct == null
      ? 0
      : estimatedLogisticsSpendPct > 20
        ? 15
        : estimatedLogisticsSpendPct > 12
          ? 8
          : 0;
  const score = Math.max(35, Math.min(98, 82 - riskPressure - spendPenalty + coverageBonus));
  const grade: "A" | "B" | "C" | "D" =
    score >= 85 ? "A" : score >= 72 ? "B" : score >= 58 ? "C" : "D";
  const narrative =
    grade === "A"
      ? "Execution is stable with manageable risk concentration."
      : grade === "B"
        ? "Growth is healthy, but a few risk pockets need intervention."
        : grade === "C"
          ? "Revenue and fulfillment risk are elevated; prioritize exception clearance."
          : "High operational stress: immediate cross-functional intervention recommended.";

  const insights: ExecutiveSummary["insights"] = [];
  if (weightedPipelineValue > openPoValue + inTransitValueEstimate) {
    insights.push({
      title: "Demand may outpace supply",
      detail:
        "Weighted demand currently exceeds open plus in-transit supply value. Review PO acceleration and allocation.",
      tone: "warning",
    });
  } else {
    insights.push({
      title: "Supply value covers modeled demand",
      detail:
        "Open procurement and in-transit inventory currently cover weighted demand in this operational model.",
      tone: "positive",
    });
  }
  if (estimatedRevenueAtRisk > 0) {
    insights.push({
      title: "Revenue at risk from inbound delays",
      detail: `${estimatedRevenueAtRisk.toFixed(
        0,
      )} USD-equivalent order value is linked to delayed inbound shipments.`,
      tone: estimatedRevenueAtRisk > 100000 ? "critical" : "warning",
    });
  }
  if (criticalStockOutRiskCount > 0) {
    insights.push({
      title: "Stock-out pressure detected",
      detail: `${criticalStockOutRiskCount} SKU(s) have allocated quantity above on-hand levels.`,
      tone: criticalStockOutRiskCount >= 4 ? "critical" : "warning",
    });
  }
  if (!insights.length) {
    insights.push({
      title: "No material pressure flagged",
      detail: "Current operational signals show no concentrated exception or stock-out pressure.",
      tone: "positive",
    });
  }
  const decisionsNext7Days: ExecutiveSummary["decisionsNext7Days"] = [];
  if ((demandCoverageRatio ?? 100) < 95) {
    decisionsNext7Days.push({
      title: "Rebalance supply against near-term demand",
      owner: "Procurement + Ops",
      reason: "Demand coverage has slipped below the preferred 95% threshold.",
    });
  }
  if (estimatedRevenueAtRisk > 0) {
    decisionsNext7Days.push({
      title: "Escalate delayed inbound impacting customer commitments",
      owner: "Control Tower lead",
      reason: "Revenue-at-risk proxy is positive; expedite late shipments and communicate ETAs.",
    });
  }
  if (criticalStockOutRiskCount > 0) {
    decisionsNext7Days.push({
      title: "Prioritize allocation for at-risk SKUs",
      owner: "Warehouse + Sales Ops",
      reason: "Allocated quantity exceeds on-hand for critical products.",
    });
  }
  if ((estimatedLogisticsSpendPct ?? 0) > 12) {
    decisionsNext7Days.push({
      title: "Review freight mode mix and lane contracts",
      owner: "Logistics procurement",
      reason: "Estimated logistics cost pressure is above the 12% watch level.",
    });
  }
  if (!decisionsNext7Days.length) {
    decisionsNext7Days.push({
      title: "Maintain current operating plan",
      owner: "Executive team",
      reason: "No high-priority escalation signal detected in current operational data.",
    });
  }

  const trendBuckets = new Map<string, ExecutiveSummary["trends"][number]>();
  for (let i = 5; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(dt);
    trendBuckets.set(key, {
      month: monthLabel(key),
      weightedPipelineValue: 0,
      openPoValue: 0,
      estimatedLogisticsSpend: 0,
    });
  }

  for (const row of weightedOppRows) {
    const key = monthKey(row.createdAt);
    const bucket = trendBuckets.get(key);
    if (!bucket) continue;
    const probability = Math.min(100, Math.max(0, n(row.probability)));
    bucket.weightedPipelineValue += (n(row.estimatedRevenue) * probability) / 100;
  }
  const poRows = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      splitParentId: null,
      status: { isEnd: false },
      createdAt: { gte: sixMonthsAgo },
    },
    select: { createdAt: true, totalAmount: true },
    take: 3000,
  });
  for (const row of poRows) {
    const key = monthKey(row.createdAt);
    const bucket = trendBuckets.get(key);
    if (!bucket) continue;
    bucket.openPoValue += n(row.totalAmount);
  }
  for (const row of delayedInboundRows) {
    const snap = row.ctFinancialSnapshots[0];
    if (!snap?.asOf) continue;
    const key = monthKey(snap.asOf);
    const bucket = trendBuckets.get(key);
    if (!bucket) continue;
    bucket.estimatedLogisticsSpend += n(snap.internalCost ?? snap.customerVisibleCost);
  }

  return {
    asOfIso: now.toISOString(),
    health: {
      score,
      grade,
      narrative,
    },
    insights: insights.slice(0, 3),
    decisionsNext7Days: decisionsNext7Days.slice(0, 4),
    kpis: {
      weightedPipelineValue,
      openPoValue,
      inTransitValueEstimate,
      estimatedLogisticsSpend,
      estimatedLogisticsSpendPct,
      demandCoverageRatio,
      estimatedRevenueAtRisk,
      openExceptions: exceptionCount,
      delayedInboundShipments,
      criticalStockOutRiskCount,
    },
    momentum: {
      weightedPipelinePctVsPrev30d: pctDelta(weightedLast30, weightedPrev30),
      openExceptionsPctVsPrev30d: pctDelta(exceptionLast30, exceptionPrev30),
      delayedInboundPctVsPrev30d: pctDelta(delayedInboundLast30, delayedInboundPrev30),
      stockOutRiskPctVsPrev30d: pctDelta(stockRiskLast30, stockRiskPrev30),
    },
    trends: Array.from(trendBuckets.values()),
    actionPanel: {
      stockOutRisks,
      delayedInbound: delayedInbound.slice(0, 5),
      customersAtRisk,
      suppliersAtRisk,
    },
  };
}
