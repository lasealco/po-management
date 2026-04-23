import { Prisma, type PrismaClient, type SrmSupplierCategory, type ShipmentMilestoneCode } from "@prisma/client";

const DEFAULT_SLA_HOURS = 24;

/**
 * SRM Phase D — PO-based KPIs for supplier analytics.
 * **Assumptions:** parent POs only (`splitParentId` null); one supplier per order header;
 * `totalAmount` + `currency` on the PO; no FX conversion (multi-currency shown separately).
 */
export type SrmKpiBySupplier = {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  /** Sum of `totalAmount` by currency (string decimals). */
  byCurrency: { currency: string; totalAmount: string }[];
};

export type SrmConcentrationBlock = {
  /** % of all orders in range belonging to the top-3 suppliers (by count). */
  top3OrderCountPct: number;
  /** % of total spend in each currency (top 3 suppliers’ share of that currency’s total). */
  byCurrency: {
    currency: string;
    totalSpend: string;
    top3Suppliers: { supplierId: string; name: string; amount: string; pctOfCurrencyTotal: number }[];
    top3SpendPct: number;
  }[];
};

export type SrmOrderVolumeKpi = {
  from: string;
  to: string;
  srmKind: SrmKindParam;
  totalOrders: number;
  bySupplier: SrmKpiBySupplier[];
  concentration: SrmConcentrationBlock;
};

export type SrmKindParam = "product" | "logistics";

/** Phase J: lifecycle / task signals for the current supplier kind (not order-windowed; point-in-time). */
export type SrmOperationalSignals = {
  /** Suppliers in tenant matching the selected SRM kind. */
  suppliersInScope: number;
  byApprovalStatus: {
    pending_approval: number;
    approved: number;
    rejected: number;
  };
  /** Onboarding tasks not done for suppliers of this kind. */
  onboardingTasksOpen: number;
  /** Open tasks with due date in the past. */
  onboardingTasksOverdue: number;
};

/**
 * Point-in-time operational snapshot: approval mix + onboarding task backlog (Phase J).
 * Independent of the analytics date window; use alongside PO/SLA metrics.
 */
export async function loadSrmOperationalSignals(
  prisma: PrismaClient,
  tenantId: string,
  args: { srmKind: SrmKindParam },
  options?: { now?: Date },
): Promise<SrmOperationalSignals> {
  const cat = srmCategoryFilter(args.srmKind);
  const now = options?.now ?? new Date();
  const supplierFilter = { tenantId, srmCategory: cat };

  const [suppliersInScope, groups, onboardingTasksOpen, onboardingTasksOverdue] = await Promise.all([
    prisma.supplier.count({ where: supplierFilter }),
    prisma.supplier.groupBy({
      by: ["approvalStatus"],
      where: supplierFilter,
      _count: { _all: true },
    }),
    prisma.supplierOnboardingTask.count({
      where: {
        tenantId,
        done: false,
        supplier: { srmCategory: cat },
      },
    }),
    prisma.supplierOnboardingTask.count({
      where: {
        tenantId,
        done: false,
        dueAt: { not: null, lt: now },
        supplier: { srmCategory: cat },
      },
    }),
  ]);

  const byApprovalStatus: SrmOperationalSignals["byApprovalStatus"] = {
    pending_approval: 0,
    approved: 0,
    rejected: 0,
  };
  for (const g of groups) {
    if (g.approvalStatus === "pending_approval") byApprovalStatus.pending_approval = g._count._all;
    if (g.approvalStatus === "approved") byApprovalStatus.approved = g._count._all;
    if (g.approvalStatus === "rejected") byApprovalStatus.rejected = g._count._all;
  }

  return {
    suppliersInScope,
    byApprovalStatus,
    onboardingTasksOpen,
    onboardingTasksOverdue,
  };
}

export type SrmBookingSlaRow = {
  bookingId: string;
  forwarderId: string;
  forwarderName: string;
  policySlaHours: number;
  bookingSentAt: string | null;
  confirmedAt: string | null;
  hoursToConfirm: number | null;
  metSla: boolean | null;
};

export type SrmBookingSlaSummary = {
  inRangeWithSent: number;
  withConfirmation: number;
  metSla: number;
  missedSla: number;
  indeterminate: number;
  sample: SrmBookingSlaRow[];
  /** When true, the UI may show a placeholder note (no milestones / no send times in range). */
  isSparse: boolean;
  disclaimer: string;
};

function srmCategoryFilter(kind: SrmKindParam): SrmSupplierCategory {
  return kind === "logistics" ? "logistics" : "product";
}

function buildOrderKpis(
  orders: {
    totalAmount: Prisma.Decimal;
    currency: string;
    supplier: { id: string; name: string } | null;
  }[],
): { bySupplier: SrmKpiBySupplier[]; concentration: SrmConcentrationBlock; totalOrders: number } {
  const totalOrders = orders.length;
  const byKey = new Map<string, { name: string; count: number; byCur: Map<string, Prisma.Decimal> }>();

  for (const o of orders) {
    if (!o.supplier) continue;
    const k = o.supplier.id;
    if (!byKey.has(k)) {
      byKey.set(k, { name: o.supplier.name, count: 0, byCur: new Map() });
    }
    const row = byKey.get(k)!;
    row.count += 1;
    const cur = o.currency || "USD";
    const prev = row.byCur.get(cur) ?? new Prisma.Decimal(0);
    row.byCur.set(cur, prev.add(o.totalAmount));
  }

  const bySupplier: SrmKpiBySupplier[] = [...byKey.entries()]
    .map(([supplierId, v]) => ({
      supplierId,
      supplierName: v.name,
      orderCount: v.count,
      byCurrency: [...v.byCur.entries()]
        .map(([currency, d]) => ({ currency, totalAmount: d.toFixed(2) }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    }))
    .sort((a, b) => b.orderCount - a.orderCount);

  // Top-3 order count % (single number across all orders in range)
  const orderSorted = [...byKey.entries()].sort((a, b) => b[1].count - a[1].count);
  const top3c = orderSorted.slice(0, 3).reduce((s, x) => s + x[1].count, 0);
  const top3OrderCountPct = totalOrders > 0 ? Math.round((1000 * top3c) / totalOrders) / 10 : 0;

  // By currency: total spend, top-3, concentration %
  const currencyTotals = new Map<string, Prisma.Decimal>();
  const perSupplierByCur = new Map<string, Map<string, Prisma.Decimal>>();
  for (const o of orders) {
    if (!o.supplier) continue;
    const cur = o.currency || "USD";
    const t = currencyTotals.get(cur) ?? new Prisma.Decimal(0);
    currencyTotals.set(cur, t.add(o.totalAmount));
    if (!perSupplierByCur.has(o.supplier.id)) {
      perSupplierByCur.set(o.supplier.id, new Map());
    }
    const m = perSupplierByCur.get(o.supplier.id)!;
    const prev = m.get(cur) ?? new Prisma.Decimal(0);
    m.set(cur, prev.add(o.totalAmount));
  }

  const byCurrency: SrmConcentrationBlock["byCurrency"] = [];
  for (const [currency, total] of [...currencyTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const supTotals = [...perSupplierByCur.entries()]
      .map(([id, m]) => {
        const d = m.get(currency) ?? new Prisma.Decimal(0);
        const name = byKey.get(id)?.name ?? id;
        return { supplierId: id, name, amount: d, amountStr: d.toFixed(2) };
      })
      .filter((x) => x.amount.gt(0))
      .sort((a, b) => b.amount.comparedTo(a.amount));

    const top3 = supTotals.slice(0, 3);
    const tDec = total;
    const top3Sum = top3.reduce((s, x) => s.add(x.amount), new Prisma.Decimal(0));
    const top3SpendPct =
      tDec.gt(0) ? Math.round(1000 * (top3Sum.toNumber() / tDec.toNumber())) / 10 : 0;
    byCurrency.push({
      currency,
      totalSpend: tDec.toFixed(2),
      top3SpendPct: Math.min(100, top3SpendPct),
      top3Suppliers: top3.map((r) => ({
        supplierId: r.supplierId,
        name: r.name,
        amount: r.amountStr,
        pctOfCurrencyTotal: tDec.gt(0) ? Math.round(1000 * (r.amount.toNumber() / tDec.toNumber())) / 10 : 0,
      })),
    });
  }

  return {
    bySupplier,
    totalOrders,
    concentration: { top3OrderCountPct, byCurrency },
  };
}

export async function loadSrmOrderVolumeKpis(
  prisma: PrismaClient,
  tenantId: string,
  args: { from: Date; to: Date; srmKind: SrmKindParam },
): Promise<SrmOrderVolumeKpi> {
  const { from, to, srmKind } = args;
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId,
      splitParentId: null,
      supplierId: { not: null },
      createdAt: { gte: from, lte: to },
      supplier: { srmCategory: srmCategoryFilter(srmKind) },
    },
    select: {
      totalAmount: true,
      currency: true,
      supplier: { select: { id: true, name: true, srmCategory: true } },
    },
  });

  const { bySupplier, concentration, totalOrders } = buildOrderKpis(orders);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    srmKind,
    totalOrders,
    bySupplier,
    concentration,
  };
}

const BOOKING_CONFIRMED: ShipmentMilestoneCode = "BOOKING_CONFIRMED";

/**
 * Sample booking flow vs `Supplier.bookingConfirmationSlaHours` (Phase D slice 24).
 * Uses `bookingSentAt` and first `BOOKING_CONFIRMED` milestone `actualAt` on the parent shipment.
 */
export async function loadSrmBookingSlaStats(
  prisma: PrismaClient,
  tenantId: string,
  args: { from: Date; to: Date },
): Promise<SrmBookingSlaSummary> {
  const { from, to } = args;
  const bookings = await prisma.shipmentBooking.findMany({
    where: {
      bookingSentAt: { not: null, gte: from, lte: to },
      forwarderSupplier: {
        tenantId,
        srmCategory: "logistics",
        isActive: true,
      },
    },
    select: {
      id: true,
      status: true,
      bookingSentAt: true,
      forwarderSupplier: {
        select: { id: true, name: true, bookingConfirmationSlaHours: true },
      },
      shipment: {
        select: {
          milestones: {
            where: { code: BOOKING_CONFIRMED },
            orderBy: { actualAt: "asc" as const },
            take: 1,
            select: { actualAt: true },
          },
        },
      },
    },
    orderBy: { bookingSentAt: "desc" as const },
    take: 200,
  });

  const sample: SrmBookingSlaRow[] = [];
  let metSla = 0;
  let missedSla = 0;
  let indeterminate = 0;
  let withConfirmation = 0;

  for (const b of bookings) {
    const fw = b.forwarderSupplier;
    if (!fw) continue;
    const policyH = fw.bookingConfirmationSlaHours ?? DEFAULT_SLA_HOURS;
    const sent = b.bookingSentAt;
    const m = b.shipment.milestones[0]?.actualAt ?? null;
    let hours: number | null = null;
    if (sent && m) {
      hours = (m.getTime() - sent.getTime()) / 3_600_000;
    }
    let met: boolean | null = null;
    if (hours != null) {
      met = hours <= policyH;
      withConfirmation += 1;
      if (met) metSla += 1;
      else missedSla += 1;
    } else {
      indeterminate += 1;
    }

    if (sample.length < 20) {
      sample.push({
        bookingId: b.id,
        forwarderId: fw.id,
        forwarderName: fw.name,
        policySlaHours: policyH,
        bookingSentAt: sent ? sent.toISOString() : null,
        confirmedAt: m ? m.toISOString() : null,
        hoursToConfirm: hours != null ? Math.round(hours * 10) / 10 : null,
        metSla: met,
      });
    }
  }

  const inRangeWithSent = bookings.length;
  const isSparse = withConfirmation === 0;
  return {
    inRangeWithSent,
    withConfirmation,
    metSla,
    missedSla,
    indeterminate,
    sample,
    isSparse,
    disclaimer:
      "MVP compares forwarder `bookingConfirmationSlaHours` (default 24) to the delay between " +
      "`bookingSentAt` and the first `BOOKING_CONFIRMED` shipment milestone. " +
      "If milestones are missing, SLA outcome is indeterminate. See GAP_MAP Phase D for caveats.",
  };
}
