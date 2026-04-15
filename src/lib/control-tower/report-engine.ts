import type { Prisma, ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";

export const CT_REPORT_DIMENSIONS = [
  "none",
  "status",
  "mode",
  "lane",
  "carrier",
  "customer",
  "supplier",
  "origin",
  "destination",
  "month",
] as const;
export type CtReportDimension = (typeof CT_REPORT_DIMENSIONS)[number];

export const CT_REPORT_MEASURES = [
  "shipments",
  "volumeCbm",
  "weightKg",
  "shippingSpend",
  "onTimePct",
  "avgDelayDays",
] as const;
export type CtReportMeasure = (typeof CT_REPORT_MEASURES)[number];

export const CT_REPORT_CHARTS = ["table", "bar", "line", "pie"] as const;
export type CtReportChartType = (typeof CT_REPORT_CHARTS)[number];

const STATUSES: ShipmentStatus[] = ["SHIPPED", "VALIDATED", "BOOKED", "IN_TRANSIT", "DELIVERED", "RECEIVED"];
const MODES: TransportMode[] = ["OCEAN", "AIR", "ROAD", "RAIL"];

export type CtReportConfig = {
  title?: string;
  chartType?: CtReportChartType;
  dimension?: CtReportDimension;
  measure?: CtReportMeasure;
  compareMeasure?: CtReportMeasure | null;
  dateField?: "shippedAt" | "receivedAt" | "bookingEta";
  dateFrom?: string | null;
  dateTo?: string | null;
  filters?: {
    status?: string | null;
    mode?: string | null;
    lane?: string | null;
    carrier?: string | null;
    customer?: string | null;
    supplier?: string | null;
    origin?: string | null;
    destination?: string | null;
  };
  topN?: number;
};

export type CtReportSeriesRow = {
  key: string;
  label: string;
  metrics: Record<CtReportMeasure, number>;
};

export type CtRunReportResult = {
  config: {
    title?: string;
    chartType: CtReportChartType;
    dimension: CtReportDimension;
    measure: CtReportMeasure;
    compareMeasure: CtReportMeasure | null;
    dateField: "shippedAt" | "receivedAt" | "bookingEta";
    topN: number;
  };
  rows: CtReportSeriesRow[];
  totals: Record<CtReportMeasure, number>;
  generatedAt: string;
};

function parseIsoDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function nonEmpty(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function sanitizeCtReportConfig(input: unknown): CtReportConfig {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const chartType = CT_REPORT_CHARTS.includes(o.chartType as CtReportChartType)
    ? (o.chartType as CtReportChartType)
    : "bar";
  const dimension = CT_REPORT_DIMENSIONS.includes(o.dimension as CtReportDimension)
    ? (o.dimension as CtReportDimension)
    : "month";
  const measure = CT_REPORT_MEASURES.includes(o.measure as CtReportMeasure)
    ? (o.measure as CtReportMeasure)
    : "shipments";
  const compareMeasure = CT_REPORT_MEASURES.includes(o.compareMeasure as CtReportMeasure)
    ? (o.compareMeasure as CtReportMeasure)
    : null;
  const dateField =
    o.dateField === "receivedAt" || o.dateField === "bookingEta" ? o.dateField : "shippedAt";
  const topNRaw = Number(o.topN);
  const topN = Number.isFinite(topNRaw) ? Math.min(50, Math.max(1, Math.floor(topNRaw))) : 12;
  const filtersObj =
    o.filters && typeof o.filters === "object" ? (o.filters as Record<string, unknown>) : {};
  return {
    title: nonEmpty(typeof o.title === "string" ? o.title : null) ?? undefined,
    chartType,
    dimension,
    measure,
    compareMeasure,
    dateField,
    dateFrom: typeof o.dateFrom === "string" ? o.dateFrom : null,
    dateTo: typeof o.dateTo === "string" ? o.dateTo : null,
    topN,
    filters: {
      status: typeof filtersObj.status === "string" ? filtersObj.status : null,
      mode: typeof filtersObj.mode === "string" ? filtersObj.mode : null,
      lane: typeof filtersObj.lane === "string" ? filtersObj.lane : null,
      carrier: typeof filtersObj.carrier === "string" ? filtersObj.carrier : null,
      customer: typeof filtersObj.customer === "string" ? filtersObj.customer : null,
      supplier: typeof filtersObj.supplier === "string" ? filtersObj.supplier : null,
      origin: typeof filtersObj.origin === "string" ? filtersObj.origin : null,
      destination: typeof filtersObj.destination === "string" ? filtersObj.destination : null,
    },
  };
}

type ShipmentRow = {
  id: string;
  status: ShipmentStatus;
  transportMode: TransportMode | null;
  shippedAt: Date;
  receivedAt: Date | null;
  carrier: string | null;
  estimatedVolumeCbm: Prisma.Decimal | null;
  estimatedWeightKg: Prisma.Decimal | null;
  customerCrmAccount: { name: string } | null;
  order: { supplier: { name: string } | null };
  booking: {
    originCode: string | null;
    destinationCode: string | null;
    eta: Date | null;
    latestEta: Date | null;
  } | null;
  ctFinancialSnapshots: Array<{
    customerVisibleCost: Prisma.Decimal | null;
    internalCost: Prisma.Decimal | null;
  }>;
};

function decimalToNumber(v: Prisma.Decimal | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function monthKey(d: Date | null): string {
  if (!d) return "Unknown";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pickDateField(r: ShipmentRow, field: "shippedAt" | "receivedAt" | "bookingEta"): Date | null {
  if (field === "receivedAt") return r.receivedAt;
  if (field === "bookingEta") return r.booking?.latestEta ?? r.booking?.eta ?? null;
  return r.shippedAt;
}

function rowDimensionValue(row: ShipmentRow, dim: CtReportDimension): string {
  switch (dim) {
    case "none":
      return "All shipments";
    case "status":
      return row.status;
    case "mode":
      return row.transportMode ?? "Unknown";
    case "lane":
      return `${row.booking?.originCode ?? "?"}->${row.booking?.destinationCode ?? "?"}`;
    case "carrier":
      return row.carrier || "Unknown";
    case "customer":
      return row.customerCrmAccount?.name || "Unknown";
    case "supplier":
      return row.order.supplier?.name || "Unknown";
    case "origin":
      return row.booking?.originCode || "Unknown";
    case "destination":
      return row.booking?.destinationCode || "Unknown";
    case "month":
      return monthKey(row.shippedAt);
  }
}

function makeZeroMetrics(): Record<CtReportMeasure, number> {
  return {
    shipments: 0,
    volumeCbm: 0,
    weightKg: 0,
    shippingSpend: 0,
    onTimePct: 0,
    avgDelayDays: 0,
  };
}

export async function runControlTowerReport(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  configInput: unknown;
}): Promise<CtRunReportResult> {
  const config = sanitizeCtReportConfig(params.configInput);
  const scope = controlTowerShipmentScopeWhere(params.tenantId, params.ctx);

  const where: Prisma.ShipmentWhereInput = { ...scope };
  const ands: Prisma.ShipmentWhereInput[] = [];
  const filters = config.filters ?? {};
  if (filters.status && STATUSES.includes(filters.status as ShipmentStatus)) {
    ands.push({ status: filters.status as ShipmentStatus });
  }
  if (filters.mode && MODES.includes(filters.mode as TransportMode)) {
    ands.push({
      OR: [{ transportMode: filters.mode as TransportMode }, { booking: { is: { mode: filters.mode as TransportMode } } }],
    });
  }
  if (nonEmpty(filters.carrier)) ands.push({ carrier: { contains: filters.carrier!.trim(), mode: "insensitive" } });
  if (nonEmpty(filters.customer)) ands.push({ customerCrmAccount: { is: { name: { contains: filters.customer!.trim(), mode: "insensitive" } } } });
  if (nonEmpty(filters.supplier)) ands.push({ order: { supplier: { is: { name: { contains: filters.supplier!.trim(), mode: "insensitive" } } } } });
  if (nonEmpty(filters.origin)) ands.push({ booking: { is: { originCode: { contains: filters.origin!.trim(), mode: "insensitive" } } } });
  if (nonEmpty(filters.destination)) ands.push({ booking: { is: { destinationCode: { contains: filters.destination!.trim(), mode: "insensitive" } } } });
  if (nonEmpty(filters.lane)) {
    const lane = filters.lane!.trim();
    ands.push({
      OR: [
        { booking: { is: { originCode: { contains: lane, mode: "insensitive" } } } },
        { booking: { is: { destinationCode: { contains: lane, mode: "insensitive" } } } },
      ],
    });
  }
  const dateField = config.dateField ?? "shippedAt";
  const from = parseIsoDate(config.dateFrom ?? null);
  const to = parseIsoDate(config.dateTo ?? null);
  if (from || to) {
    if (dateField === "bookingEta") {
      ands.push({
        booking: {
          is: {
            OR: [
              { latestEta: { gte: from ?? undefined, lte: to ?? undefined } },
              { eta: { gte: from ?? undefined, lte: to ?? undefined } },
            ],
          },
        },
      });
    } else if (dateField === "receivedAt") {
      ands.push({ receivedAt: { gte: from ?? undefined, lte: to ?? undefined } });
    } else {
      ands.push({ shippedAt: { gte: from ?? undefined, lte: to ?? undefined } });
    }
  }
  if (ands.length) where.AND = ands;

  const rows = (await prisma.shipment.findMany({
    where,
    take: 10000,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      transportMode: true,
      shippedAt: true,
      receivedAt: true,
      carrier: true,
      estimatedVolumeCbm: true,
      estimatedWeightKg: true,
      customerCrmAccount: { select: { name: true } },
      order: { select: { supplier: { select: { name: true } } } },
      booking: { select: { originCode: true, destinationCode: true, eta: true, latestEta: true } },
      ctFinancialSnapshots: {
        select: { customerVisibleCost: true, internalCost: true },
        orderBy: { asOf: "desc" },
        take: 1,
      },
    },
  })) as ShipmentRow[];

  const grouped = new Map<string, CtReportSeriesRow>();
  const totals = makeZeroMetrics();
  for (const r of rows) {
    const dateValue = pickDateField(r, dateField);
    if ((from && (!dateValue || dateValue < from)) || (to && (!dateValue || dateValue > to))) continue;
    const key = rowDimensionValue(r, config.dimension ?? "month");
    const existing = grouped.get(key) ?? { key, label: key, metrics: makeZeroMetrics() };
    existing.metrics.shipments += 1;
    existing.metrics.volumeCbm += decimalToNumber(r.estimatedVolumeCbm);
    existing.metrics.weightKg += decimalToNumber(r.estimatedWeightKg);
    const snapshot = r.ctFinancialSnapshots[0];
    existing.metrics.shippingSpend += params.ctx.isRestrictedView
      ? decimalToNumber(snapshot?.customerVisibleCost)
      : decimalToNumber(snapshot?.internalCost) || decimalToNumber(snapshot?.customerVisibleCost);
    const etaRef = r.booking?.latestEta ?? r.booking?.eta;
    if (etaRef && r.receivedAt) {
      const delayDays = (r.receivedAt.getTime() - etaRef.getTime()) / 86400000;
      existing.metrics.avgDelayDays += delayDays;
      if (delayDays <= 0) existing.metrics.onTimePct += 1;
    }
    grouped.set(key, existing);
  }

  const normalized = Array.from(grouped.values()).map((row) => {
    const count = row.metrics.shipments || 0;
    const onTimeCount = row.metrics.onTimePct;
    const avgDelaySum = row.metrics.avgDelayDays;
    row.metrics.onTimePct = count ? Number(((onTimeCount / count) * 100).toFixed(2)) : 0;
    row.metrics.avgDelayDays = count ? Number((avgDelaySum / count).toFixed(2)) : 0;
    return row;
  });

  normalized.sort((a, b) => {
    if (config.dimension === "month") return a.key.localeCompare(b.key);
    const m = config.measure ?? "shipments";
    return (b.metrics[m] ?? 0) - (a.metrics[m] ?? 0);
  });

  const sliced = config.dimension === "month" ? normalized : normalized.slice(0, config.topN ?? 12);
  for (const r of sliced) {
    for (const m of CT_REPORT_MEASURES) totals[m] += r.metrics[m] ?? 0;
  }
  totals.onTimePct = sliced.length ? Number((totals.onTimePct / sliced.length).toFixed(2)) : 0;
  totals.avgDelayDays = sliced.length ? Number((totals.avgDelayDays / sliced.length).toFixed(2)) : 0;

  return {
    config: {
      title: config.title,
      chartType: config.chartType ?? "bar",
      dimension: config.dimension ?? "month",
      measure: config.measure ?? "shipments",
      compareMeasure: config.compareMeasure ?? null,
      dateField: config.dateField ?? "shippedAt",
      topN: config.topN ?? 12,
    },
    rows: sliced,
    totals,
    generatedAt: new Date().toISOString(),
  };
}
