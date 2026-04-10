import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type SupplierOrderAnalytics = {
  /** Parent POs only (matches board / reports convention). */
  parentOrderCount: number;
  splitChildOrderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  totalByCurrency: {
    currency: string;
    orderCount: number;
    totalAmount: string;
  }[];
  byStatus: {
    statusLabel: string;
    statusCode: string;
    orderCount: number;
    pctOfOrders: number;
  }[];
  /** Rolling last 12 calendar months (UTC), including zeros. */
  last12Months: {
    yearMonth: string;
    label: string;
    orderCount: number;
    byCurrency: { currency: string; totalAmount: string }[];
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    title: string | null;
    createdAt: string;
    currency: string;
    totalAmount: string;
    statusLabel: string;
    statusCode: string;
  }[];
  /** Derived from transitions, shared messages, and ASNs vs requested delivery (UTC dates). */
  performance: SupplierPerformanceMetrics;
};

export type SupplierPerformanceMetrics = {
  confirmation: {
    ordersSentToSupplier: number;
    ordersConfirmedAfterSend: number;
    ordersDeclinedAfterSend: number;
    /** Buyer cancelled after PO was sent (no supplier confirm). */
    ordersBuyerCancelledAfterSend: number;
    ordersAwaitingConfirmation: number;
    avgHoursToConfirm: number | null;
    medianHoursToConfirm: number | null;
    p90HoursToConfirm: number | null;
  };
  /** First non-internal chat after PO was sent (buyer or supplier). */
  sharedThread: {
    ordersSentToSupplier: number;
    ordersWithSharedReplyAfterSend: number;
    avgHoursToFirstSharedReply: number | null;
    medianHoursToFirstSharedReply: number | null;
  };
  /** Earliest ASN `shippedAt` vs PO `requestedDeliveryDate` (calendar day, UTC). */
  shippingVsRequested: {
    ordersWithRequestedDelivery: number;
    ordersShippedWithDueDate: number;
    onTimeShipCount: number;
    lateShipCount: number;
    awaitingShipmentCount: number;
    onTimeShipPct: number | null;
  };
  /**
   * First non-internal chat after send from a user assigned any role listed in
   * `getSupplierPortalRoleNames()` (default: seeded `Supplier portal`; override via env).
   */
  supplierPortal: {
    ordersSentToSupplier: number;
    ordersWithSupplierPortalMessageAfterSend: number;
    avgHoursToFirstSupplierPortalMessage: number | null;
    medianHoursToFirstSupplierPortalMessage: number | null;
  };
  /** Each `ShipmentItem` with `plannedShipDate`: ASN `shippedAt` vs plan (UTC calendar days). */
  lineShipVsPlanned: {
    linesWithPlannedShipDate: number;
    onTimeLineCount: number;
    lateLineCount: number;
    onTimeLinePct: number | null;
  };
};

/** Seeded demo role name; override at deploy time with `SUPPLIER_PORTAL_ROLE_NAMES`. */
export const DEFAULT_SUPPLIER_PORTAL_ROLE_NAME = "Supplier portal";

/**
 * Role names that identify supplier-portal users for chat analytics.
 * Set `SUPPLIER_PORTAL_ROLE_NAMES` to a comma-separated list (e.g. `Supplier portal,Vendor`).
 * Defaults to the seeded `Supplier portal` role when unset or empty.
 */
export function getSupplierPortalRoleNames(): string[] {
  const raw = process.env.SUPPLIER_PORTAL_ROLE_NAMES?.trim() ?? "";
  if (!raw) return [DEFAULT_SUPPLIER_PORTAL_ROLE_NAME];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [DEFAULT_SUPPLIER_PORTAL_ROLE_NAME];
}

function medianHours(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const raw = s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  return Math.round(raw * 10) / 10;
}

function p90Hours(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(0.9 * s.length) - 1));
  return Math.round(s[idx]! * 10) / 10;
}

function avgHours(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yearMonthUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function buildLast12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 1));
    keys.push(yearMonthUtc(d));
  }
  return keys;
}

export async function fetchSupplierOrderAnalytics(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<SupplierOrderAnalytics> {
  const [parentRows, splitChildOrderCount] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        supplierId,
        splitParentId: null,
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        createdAt: true,
        totalAmount: true,
        currency: true,
        requestedDeliveryDate: true,
        status: { select: { code: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseOrder.count({
      where: {
        tenantId,
        supplierId,
        splitParentId: { not: null },
      },
    }),
  ]);

  const parentOrderCount = parentRows.length;
  const dates = parentRows.map((r) => r.createdAt.getTime());
  const firstOrderAt =
    dates.length > 0
      ? new Date(Math.min(...dates)).toISOString()
      : null;
  const lastOrderAt =
    dates.length > 0
      ? new Date(Math.max(...dates)).toISOString()
      : null;

  const currencyMap = new Map<string, { orderCount: number; sum: Prisma.Decimal }>();
  for (const r of parentRows) {
    const cur = r.currency;
    const prev = currencyMap.get(cur) ?? {
      orderCount: 0,
      sum: new Prisma.Decimal(0),
    };
    prev.orderCount += 1;
    prev.sum = prev.sum.add(r.totalAmount);
    currencyMap.set(cur, prev);
  }
  const totalByCurrency = [...currencyMap.entries()]
    .map(([currency, v]) => ({
      currency,
      orderCount: v.orderCount,
      totalAmount: v.sum.toString(),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const statusMap = new Map<string, { label: string; code: string; count: number }>();
  for (const r of parentRows) {
    const key = r.status.code;
    const ex = statusMap.get(key);
    if (ex) ex.count += 1;
    else
      statusMap.set(key, {
        label: r.status.label,
        code: r.status.code,
        count: 1,
      });
  }
  const byStatus = [...statusMap.values()]
    .map((s) => ({
      statusLabel: s.label,
      statusCode: s.code,
      orderCount: s.count,
      pctOfOrders:
        parentOrderCount > 0 ? Math.round((s.count / parentOrderCount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.orderCount - a.orderCount);

  const monthKeys = buildLast12MonthKeys();
  const monthly = new Map<
    string,
    { orderCount: number; byCur: Map<string, Prisma.Decimal> }
  >();
  for (const k of monthKeys) {
    monthly.set(k, {
      orderCount: 0,
      byCur: new Map(),
    });
  }
  for (const r of parentRows) {
    const ym = yearMonthUtc(r.createdAt);
    const bucket = monthly.get(ym);
    if (!bucket) continue;
    bucket.orderCount += 1;
    const cur = r.currency;
    const prevSum = bucket.byCur.get(cur) ?? new Prisma.Decimal(0);
    bucket.byCur.set(cur, prevSum.add(r.totalAmount));
  }
  const last12Months = monthKeys.map((yearMonth) => {
    const b = monthly.get(yearMonth)!;
    const byCurrency = [...b.byCur.entries()]
      .map(([currency, sum]) => ({ currency, totalAmount: sum.toString() }))
      .sort((x, y) => x.currency.localeCompare(y.currency));
    return {
      yearMonth,
      label: monthLabel(yearMonth),
      orderCount: b.orderCount,
      byCurrency,
    };
  });

  const recentOrders = parentRows.slice(0, 12).map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    currency: r.currency,
    totalAmount: r.totalAmount.toString(),
    statusLabel: r.status.label,
    statusCode: r.status.code,
  }));

  const performance = await computeSupplierPerformance(prisma, tenantId, parentRows);

  return {
    parentOrderCount,
    splitChildOrderCount,
    firstOrderAt,
    lastOrderAt,
    totalByCurrency,
    byStatus,
    last12Months,
    recentOrders,
    performance,
  };
}

type ParentRowForPerf = {
  id: string;
  requestedDeliveryDate: Date | null;
};

async function computeSupplierPerformance(
  prisma: PrismaClient,
  tenantId: string,
  parentRows: ParentRowForPerf[],
): Promise<SupplierPerformanceMetrics> {
  const empty: SupplierPerformanceMetrics = {
    confirmation: {
      ordersSentToSupplier: 0,
      ordersConfirmedAfterSend: 0,
      ordersDeclinedAfterSend: 0,
      ordersBuyerCancelledAfterSend: 0,
      ordersAwaitingConfirmation: 0,
      avgHoursToConfirm: null,
      medianHoursToConfirm: null,
      p90HoursToConfirm: null,
    },
    sharedThread: {
      ordersSentToSupplier: 0,
      ordersWithSharedReplyAfterSend: 0,
      avgHoursToFirstSharedReply: null,
      medianHoursToFirstSharedReply: null,
    },
    shippingVsRequested: {
      ordersWithRequestedDelivery: 0,
      ordersShippedWithDueDate: 0,
      onTimeShipCount: 0,
      lateShipCount: 0,
      awaitingShipmentCount: 0,
      onTimeShipPct: null,
    },
    supplierPortal: {
      ordersSentToSupplier: 0,
      ordersWithSupplierPortalMessageAfterSend: 0,
      avgHoursToFirstSupplierPortalMessage: null,
      medianHoursToFirstSupplierPortalMessage: null,
    },
    lineShipVsPlanned: {
      linesWithPlannedShipDate: 0,
      onTimeLineCount: 0,
      lateLineCount: 0,
      onTimeLinePct: null,
    },
  };

  if (parentRows.length === 0) {
    return empty;
  }

  const orderIds = parentRows.map((r) => r.id);
  const supplierPortalRoleNames = getSupplierPortalRoleNames();

  const [logs, msgs, shipGroups, supplierPortalRoleRows, lineShipRows] = await Promise.all([
    prisma.orderTransitionLog.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: {
        orderId: true,
        actionCode: true,
        createdAt: true,
      },
    }),
    prisma.orderChatMessage.findMany({
      where: {
        orderId: { in: orderIds },
        isInternal: false,
      },
      orderBy: { createdAt: "asc" },
      select: { orderId: true, createdAt: true, authorUserId: true },
    }),
    prisma.shipment.groupBy({
      by: ["orderId"],
      where: { orderId: { in: orderIds } },
      _min: { shippedAt: true },
    }),
    prisma.userRole.findMany({
      where: {
        user: { tenantId },
        role: { tenantId, name: { in: supplierPortalRoleNames } },
      },
      select: { userId: true },
    }),
    prisma.shipmentItem.findMany({
      where: {
        plannedShipDate: { not: null },
        shipment: { orderId: { in: orderIds } },
      },
      select: {
        plannedShipDate: true,
        shipment: { select: { shippedAt: true } },
      },
    }),
  ]);

  const supplierPortalUserIds = new Set(supplierPortalRoleRows.map((r) => r.userId));

  const logsByOrder = new Map<string, typeof logs>();
  for (const log of logs) {
    const list = logsByOrder.get(log.orderId) ?? [];
    list.push(log);
    logsByOrder.set(log.orderId, list);
  }

  const firstSharedByOrder = new Map<string, Date>();
  const msgsByOrder = new Map<string, typeof msgs>();
  for (const m of msgs) {
    if (!firstSharedByOrder.has(m.orderId)) {
      firstSharedByOrder.set(m.orderId, m.createdAt);
    }
    const list = msgsByOrder.get(m.orderId) ?? [];
    list.push(m);
    msgsByOrder.set(m.orderId, list);
  }

  const firstShipByOrder = new Map(
    shipGroups.map((g) => [g.orderId, g._min.shippedAt] as const),
  );

  const dueByOrder = new Map(
    parentRows.map((r) => [r.id, r.requestedDeliveryDate] as const),
  );

  const confirmHoursList: number[] = [];
  const sharedReplyHoursList: number[] = [];
  const supplierPortalHoursList: number[] = [];

  let ordersSentToSupplier = 0;
  let ordersConfirmedAfterSend = 0;
  let ordersDeclinedAfterSend = 0;
  let ordersBuyerCancelledAfterSend = 0;
  let ordersAwaitingConfirmation = 0;

  let ordersWithRequestedDelivery = 0;
  let ordersShippedWithDueDate = 0;
  let onTimeShipCount = 0;
  let lateShipCount = 0;
  let awaitingShipmentCount = 0;

  for (const row of parentRows) {
    const oid = row.id;
    const evs = logsByOrder.get(oid) ?? [];

    let firstSend: Date | null = null;
    for (const e of evs) {
      if (e.actionCode === "send_to_supplier") {
        firstSend = e.createdAt;
        break;
      }
    }

    if (firstSend) {
      ordersSentToSupplier += 1;

      let firstConfirm: Date | null = null;
      let firstDecline: Date | null = null;
      let firstBuyerCancel: Date | null = null;
      for (const e of evs) {
        if (e.createdAt < firstSend) continue;
        if (e.actionCode === "confirm" && !firstConfirm) firstConfirm = e.createdAt;
        if (e.actionCode === "decline" && !firstDecline) firstDecline = e.createdAt;
        if (e.actionCode === "buyer_cancel" && !firstBuyerCancel) firstBuyerCancel = e.createdAt;
      }

      if (firstConfirm) {
        ordersConfirmedAfterSend += 1;
        confirmHoursList.push((firstConfirm.getTime() - firstSend.getTime()) / 3_600_000);
      } else if (firstDecline) {
        ordersDeclinedAfterSend += 1;
      } else if (firstBuyerCancel) {
        ordersBuyerCancelledAfterSend += 1;
      } else {
        ordersAwaitingConfirmation += 1;
      }

      const firstShared = firstSharedByOrder.get(oid);
      if (firstShared && firstShared >= firstSend) {
        sharedReplyHoursList.push((firstShared.getTime() - firstSend.getTime()) / 3_600_000);
      }

      const orderMsgs = msgsByOrder.get(oid) ?? [];
      let firstPortal: Date | null = null;
      for (const m of orderMsgs) {
        if (m.createdAt < firstSend) continue;
        if (supplierPortalUserIds.has(m.authorUserId)) {
          firstPortal = m.createdAt;
          break;
        }
      }
      if (firstPortal) {
        supplierPortalHoursList.push((firstPortal.getTime() - firstSend.getTime()) / 3_600_000);
      }
    }

    const due = dueByOrder.get(oid) ?? null;
    const firstShip = firstShipByOrder.get(oid) ?? null;

    if (due) {
      ordersWithRequestedDelivery += 1;
      if (firstShip) {
        ordersShippedWithDueDate += 1;
        const dueDay = utcDayString(due);
        const shipDay = utcDayString(firstShip);
        if (shipDay <= dueDay) onTimeShipCount += 1;
        else lateShipCount += 1;
      } else {
        awaitingShipmentCount += 1;
      }
    }
  }

  const ordersWithSharedReplyAfterSend = sharedReplyHoursList.length;
  const ordersWithSupplierPortalMessageAfterSend = supplierPortalHoursList.length;

  let lineOnTime = 0;
  let lineLate = 0;
  for (const row of lineShipRows) {
    const plan = row.plannedShipDate;
    if (!plan) continue;
    const shipDay = utcDayString(row.shipment.shippedAt);
    const planDay = utcDayString(plan);
    if (shipDay <= planDay) lineOnTime += 1;
    else lineLate += 1;
  }
  const linesWithPlannedShipDate = lineOnTime + lineLate;
  const onTimeLinePct =
    linesWithPlannedShipDate > 0
      ? Math.round((lineOnTime / linesWithPlannedShipDate) * 1000) / 10
      : null;

  const onTimeShipPct =
    ordersShippedWithDueDate > 0
      ? Math.round((onTimeShipCount / ordersShippedWithDueDate) * 1000) / 10
      : null;

  return {
    confirmation: {
      ordersSentToSupplier,
      ordersConfirmedAfterSend,
      ordersDeclinedAfterSend,
      ordersBuyerCancelledAfterSend,
      ordersAwaitingConfirmation,
      avgHoursToConfirm: avgHours(confirmHoursList),
      medianHoursToConfirm: medianHours(confirmHoursList),
      p90HoursToConfirm: p90Hours(confirmHoursList),
    },
    sharedThread: {
      ordersSentToSupplier,
      ordersWithSharedReplyAfterSend,
      avgHoursToFirstSharedReply: avgHours(sharedReplyHoursList),
      medianHoursToFirstSharedReply: medianHours(sharedReplyHoursList),
    },
    shippingVsRequested: {
      ordersWithRequestedDelivery,
      ordersShippedWithDueDate,
      onTimeShipCount,
      lateShipCount,
      awaitingShipmentCount,
      onTimeShipPct,
    },
    supplierPortal: {
      ordersSentToSupplier,
      ordersWithSupplierPortalMessageAfterSend,
      avgHoursToFirstSupplierPortalMessage: avgHours(supplierPortalHoursList),
      medianHoursToFirstSupplierPortalMessage: medianHours(supplierPortalHoursList),
    },
    lineShipVsPlanned: {
      linesWithPlannedShipDate,
      onTimeLineCount: lineOnTime,
      lateLineCount: lineLate,
      onTimeLinePct,
    },
  };
}

/** Parent PO count plus performance metrics only (for reports). */
export async function fetchSupplierPerformanceSummary(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<{ parentOrderCount: number; performance: SupplierPerformanceMetrics }> {
  const parentRows = await prisma.purchaseOrder.findMany({
    where: { tenantId, supplierId, splitParentId: null },
    select: { id: true, requestedDeliveryDate: true },
  });
  const performance = await computeSupplierPerformance(prisma, tenantId, parentRows);
  return { parentOrderCount: parentRows.length, performance };
}
