import { CtExceptionStatus, type Prisma, type ShipmentStatus, type TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { convertAmount, minorToAmount, normalizeCurrency } from "@/lib/control-tower/currency";

import { buildControlTowerReportCsv as buildReportCsvSnapshot } from "./report-csv";

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
  "exceptionCatalog",
] as const;
export type CtReportDimension = (typeof CT_REPORT_DIMENSIONS)[number];

export const CT_REPORT_MEASURES = [
  "shipments",
  "volumeCbm",
  "weightKg",
  "shippingSpend",
  "onTimePct",
  "avgDelayDays",
  "openExceptions",
] as const;
export type CtReportMeasure = (typeof CT_REPORT_MEASURES)[number];

export const CT_REPORT_CHARTS = ["table", "bar", "line", "pie"] as const;
export type CtReportChartType = (typeof CT_REPORT_CHARTS)[number];

const STATUSES: ShipmentStatus[] = [
  "BOOKING_DRAFT",
  "BOOKING_SUBMITTED",
  "SHIPPED",
  "VALIDATED",
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "RECEIVED",
];
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
    carrierSupplierId?: string | null;
    customerCrmAccountId?: string | null;
    supplierId?: string | null;
    origin?: string | null;
    destination?: string | null;
    onlyOpenExceptions?: boolean;
  };
  topN?: number;
};

export type CtReportSeriesRow = {
  key: string;
  label: string;
  metrics: Record<CtReportMeasure, number>;
};

export type CtReportCoverage = {
  /** Shipments returned by the filtered Prisma query (max 10k). */
  totalShipmentsQueried: number;
  /** Shipments that passed the report date window and were rolled into dimension buckets. */
  shipmentsAggregated: number;
  /** Shipments skipped because the selected date field was missing or fell outside from/to. */
  excludedByDateOrMissingDateField: number;
  /** Distinct dimension buckets before Top-N truncation (equals shown count for month dimension). */
  dimensionGroupsTotal: number;
  /** Dimension buckets returned in rows (chart / primary table). */
  dimensionGroupsShown: number;
};

export type CtRunReportResult = {
  config: {
    title?: string;
    chartType: CtReportChartType;
    dimension: CtReportDimension;
    measure: CtReportMeasure;
    compareMeasure: CtReportMeasure | null;
    dateField: "shippedAt" | "receivedAt" | "bookingEta";
    /** Echo of sanitized config; used for PDF / email date window lines. */
    dateFrom: string | null;
    dateTo: string | null;
    topN: number;
  };
  /** Chart / builder primary series (Top-N except month, which keeps full timeline). */
  rows: CtReportSeriesRow[];
  /** All dimension buckets after aggregation (no Top-N cap); use for exports and full tables. */
  fullSeriesRows: CtReportSeriesRow[];
  coverage: CtReportCoverage;
  totals: Record<CtReportMeasure, number>;
  generatedAt: string;
};

/** UTF-8 CSV (bucket + all measures + TOTAL row). Prefers `fullSeriesRows` when non-empty. */
export function buildControlTowerReportCsv(result: CtRunReportResult): string {
  return buildReportCsvSnapshot({
    rows: result.rows,
    fullSeriesRows: result.fullSeriesRows,
    totals: result.totals,
  });
}

function parseIsoDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function nonEmpty(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function normalizeExceptionTypeKey(type: string): string {
  return type.trim().toLowerCase();
}

export function exceptionCatalogBucket(params: {
  rawType: string;
  catalogByNormalizedCode: Map<string, { code: string; label: string }>;
}): { rowKey: string; rowLabel: string } {
  const t = params.rawType.trim();
  if (!t) {
    return { rowKey: "(blank)", rowLabel: "Blank type" };
  }
  const hit = params.catalogByNormalizedCode.get(normalizeExceptionTypeKey(t));
  if (hit) {
    return { rowKey: hit.code, rowLabel: `${hit.label} (${hit.code})` };
  }
  return { rowKey: t, rowLabel: `Unlisted (${t})` };
}

export function sanitizeCtReportConfig(input: unknown): CtReportConfig {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const chartType = CT_REPORT_CHARTS.includes(o.chartType as CtReportChartType)
    ? (o.chartType as CtReportChartType)
    : "bar";
  const dimension = CT_REPORT_DIMENSIONS.includes(o.dimension as CtReportDimension)
    ? (o.dimension as CtReportDimension)
    : "month";
  let measure = CT_REPORT_MEASURES.includes(o.measure as CtReportMeasure)
    ? (o.measure as CtReportMeasure)
    : "shipments";
  if (dimension === "exceptionCatalog") measure = "openExceptions";
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
      carrierSupplierId:
        typeof filtersObj.carrierSupplierId === "string" ? filtersObj.carrierSupplierId : null,
      customerCrmAccountId:
        typeof filtersObj.customerCrmAccountId === "string"
          ? filtersObj.customerCrmAccountId
          : null,
      supplierId: typeof filtersObj.supplierId === "string" ? filtersObj.supplierId : null,
      origin: typeof filtersObj.origin === "string" ? filtersObj.origin : null,
      destination: typeof filtersObj.destination === "string" ? filtersObj.destination : null,
      onlyOpenExceptions: filtersObj.onlyOpenExceptions === true,
    },
  };
}

type ShipmentRow = {
  id: string;
  status: ShipmentStatus;
  transportMode: TransportMode | null;
  shippedAt: Date;
  receivedAt: Date | null;
  carrierSupplierId: string | null;
  carrier: string | null;
  carrierSupplier: { name: string } | null;
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
  ctCostLines: Array<{
    amountMinor: bigint;
    currency: string;
  }>;
  ctExceptions: Array<{ type: string }>;
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
      return `${row.booking?.originCode ?? "?"}→${row.booking?.destinationCode ?? "?"}`;
    case "carrier": {
      const fromParty = row.carrierSupplier?.name?.trim();
      if (fromParty) return fromParty;
      const legacy = row.carrier?.trim();
      if (legacy) return legacy;
      return "No carrier / forwarder set";
    }
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
    case "exceptionCatalog":
      return "—";
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
    openExceptions: 0,
  };
}

export async function runControlTowerReport(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  configInput: unknown;
  actorUserId?: string;
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
  if (nonEmpty(filters.carrierSupplierId)) ands.push({ carrierSupplierId: filters.carrierSupplierId!.trim() });
  if (nonEmpty(filters.customerCrmAccountId)) {
    ands.push({ customerCrmAccountId: filters.customerCrmAccountId!.trim() });
  }
  if (nonEmpty(filters.supplierId)) ands.push({ order: { supplierId: filters.supplierId!.trim() } });
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
  if (filters.onlyOpenExceptions === true) {
    ands.push({
      ctExceptions: {
        some: { status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] } },
      },
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
      carrierSupplierId: true,
      carrier: true,
      carrierSupplier: { select: { name: true } },
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
      ctCostLines: {
        select: { amountMinor: true, currency: true },
      },
      ctExceptions: {
        where: { status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] } },
        select: { type: true },
      },
    },
  })) as ShipmentRow[];

  const dim = config.dimension ?? "month";
  const catalogByNorm =
    dim === "exceptionCatalog"
      ? new Map(
          (
            await prisma.ctExceptionCode.findMany({
              where: { tenantId: params.tenantId, isActive: true },
              select: { code: true, label: true },
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
            })
          ).map((c) => [
            normalizeExceptionTypeKey(c.code),
            { code: c.code.trim(), label: c.label.trim() },
          ]),
        )
      : null;

  let displayCurrency = "USD";
  if (params.actorUserId) {
    const pref = await prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId: params.actorUserId,
          key: "controlTower.displayCurrency",
        },
      },
      select: { value: true },
    });
    const prefCurrencyRaw =
      pref && pref.value && typeof pref.value === "object" && "currency" in pref.value
        ? (pref.value as { currency?: unknown }).currency
        : null;
    displayCurrency = normalizeCurrency(typeof prefCurrencyRaw === "string" ? prefCurrencyRaw : "USD");
  }
  const costCurrencies = Array.from(
    new Set(
      rows.flatMap((r) =>
        r.ctCostLines.map((c) => normalizeCurrency(c.currency)),
      ),
    ),
  );
  const fxRatesRaw =
    costCurrencies.length > 0
      ? await prisma.ctFxRate.findMany({
          where: {
            tenantId: params.tenantId,
            OR: [
              { baseCurrency: { in: costCurrencies }, quoteCurrency: displayCurrency },
              { baseCurrency: displayCurrency, quoteCurrency: { in: costCurrencies } },
            ],
          },
          orderBy: { rateDate: "desc" },
        })
      : [];
  const seenFx = new Set<string>();
  const latestFxRates = fxRatesRaw.filter((r) => {
    const k = `${r.baseCurrency}->${r.quoteCurrency}`;
    if (seenFx.has(k)) return false;
    seenFx.add(k);
    return true;
  });

  const grouped = new Map<string, CtReportSeriesRow>();
  const totals = makeZeroMetrics();
  let excludedByDateOrMissingDateField = 0;
  let shipmentsAggregated = 0;
  for (const r of rows) {
    const dateValue = pickDateField(r, dateField);
    if ((from && (!dateValue || dateValue < from)) || (to && (!dateValue || dateValue > to))) {
      excludedByDateOrMissingDateField += 1;
      continue;
    }
    shipmentsAggregated += 1;

    if (dim === "exceptionCatalog" && catalogByNorm) {
      for (const exc of r.ctExceptions) {
        const raw = exc.type?.trim() ?? "";
        if (!raw) continue;
        const { rowKey, rowLabel } = exceptionCatalogBucket({
          rawType: raw,
          catalogByNormalizedCode: catalogByNorm,
        });
        const existing = grouped.get(rowKey) ?? { key: rowKey, label: rowLabel, metrics: makeZeroMetrics() };
        existing.label = rowLabel;
        existing.metrics.openExceptions += 1;
        grouped.set(rowKey, existing);
      }
      continue;
    }

    const key = rowDimensionValue(r, dim);
    const existing = grouped.get(key) ?? { key, label: key, metrics: makeZeroMetrics() };
    existing.metrics.shipments += 1;
    existing.metrics.openExceptions += r.ctExceptions.length;
    existing.metrics.volumeCbm += decimalToNumber(r.estimatedVolumeCbm);
    existing.metrics.weightKg += decimalToNumber(r.estimatedWeightKg);
    if (r.ctCostLines.length > 0) {
      const convertedSum = r.ctCostLines.reduce((sum, line) => {
        const converted = convertAmount({
          amount: minorToAmount(line.amountMinor),
          sourceCurrency: normalizeCurrency(line.currency),
          targetCurrency: displayCurrency,
          rates: latestFxRates,
        });
        return sum + (converted.converted ?? 0);
      }, 0);
      existing.metrics.shippingSpend += convertedSum;
    } else {
      const snapshot = r.ctFinancialSnapshots[0];
      existing.metrics.shippingSpend += params.ctx.isRestrictedView
        ? decimalToNumber(snapshot?.customerVisibleCost)
        : decimalToNumber(snapshot?.internalCost) || decimalToNumber(snapshot?.customerVisibleCost);
    }
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
    if (dim === "month") return a.key.localeCompare(b.key);
    const m = config.measure ?? "shipments";
    return (b.metrics[m] ?? 0) - (a.metrics[m] ?? 0);
  });

  const sliced = dim === "month" ? normalized : normalized.slice(0, config.topN ?? 12);
  const coverage: CtReportCoverage = {
    totalShipmentsQueried: rows.length,
    shipmentsAggregated,
    excludedByDateOrMissingDateField,
    dimensionGroupsTotal: normalized.length,
    dimensionGroupsShown: sliced.length,
  };
  for (const r of sliced) {
    for (const m of CT_REPORT_MEASURES) totals[m] += r.metrics[m] ?? 0;
  }
  totals.onTimePct = sliced.length ? Number((totals.onTimePct / sliced.length).toFixed(2)) : 0;
  totals.avgDelayDays = sliced.length ? Number((totals.avgDelayDays / sliced.length).toFixed(2)) : 0;

  return {
    config: {
      title: config.title,
      chartType: config.chartType ?? "bar",
      dimension: dim,
      measure: config.measure ?? "shipments",
      compareMeasure: config.compareMeasure ?? null,
      dateField: config.dateField ?? "shippedAt",
      dateFrom: config.dateFrom ?? null,
      dateTo: config.dateTo ?? null,
      topN: config.topN ?? 12,
    },
    rows: sliced,
    fullSeriesRows: normalized,
    coverage,
    totals,
    generatedAt: new Date().toISOString(),
  };
}
